import { Client } from '@notionhq/client'; // Import Notion Client
import dotenv from 'dotenv'; // Import dotenv
import { Octokit } from 'octokit'; // Import octokit
import _ from 'lodash'; // Import lodash

// Initialize variables
dotenv.config();
const octokit = new Octokit({ auth: process.env.GITHUB_KEY });
const notion = new Client({ auth: process.env.NOTION_KEY });

const issuesDB = process.env.NOTION_DATABASE_ID_ISSUES;
const pullRequestDB = process.env.NOTION_DATABASE_ID_PR;
const OPERATION_BATCH_SIZE = 10;

const gitHubIssuesIdToNotionPageId: {}[] = [] // Maps GitHub issue numbers to Notion page IDs

// Get issues already stored on Notion DB and then sync with github ones
setInitialGitHubToNotionIdMap().then(syncNotionDatabaseWithGitHub)



async function setInitialGitHubToNotionIdMap() {
  const stockedIssues = await getIssuesFromNotionDatabase();
    for (const { pageId, issueNumber } of stockedIssues) {
      gitHubIssuesIdToNotionPageId[issueNumber] = pageId;
    }

}

// Retrieve issues from GitHub API and sync with the one present on Notion
async function syncNotionDatabaseWithGitHub() {

  // Get all issues currently in the provided GitHub repository.
  console.log("\nFetching issues from Notion DB...")
  const issues = await getGitHubIssuesForRepository()
  console.log(`Fetched ${issues.length} issues from GitHub repository.`)

  // Group issues into those that need to be created or updated in the Notion database.
  const { pagesToCreate, pagesToUpdate } = getNotionOperations(issues)

  // Create pages for new issues.
  console.log(`\n${pagesToCreate.length} new issues to add to Notion.`)
  await createPages(pagesToCreate)

  // Updates pages for existing issues.
  console.log(`\n${pagesToUpdate.length} issues to update in Notion.`)
  await updatePages(pagesToUpdate)

  // Success!
  console.log("\n✅ Notion database is synced with GitHub.")
}

// Retrieve issues already in notion database.
async function getIssuesFromNotionDatabase() {

  const pages = [] as any;
  let cursor: string | undefined;
  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: issuesDB as string,
      start_cursor: cursor,
    })
    pages.push(...results)
    if (!next_cursor) {
      break;
    }
    cursor = next_cursor;
  }
  console.log(`${pages.length} issues successfully fetched.`)
  console.log(pages.length)
  return pages.map(page => {
    return {
      pageId: page.id,
      issueNumber: page.properties["ID"].number,
    }
  })
}





async function getGitHubIssuesForRepository() {
  const issues: { number: number, title: string, state: string, comment_count: number, url: string, repository: string, author: string }[] = []
  const iterator = octokit.paginate.iterator(octokit.rest.issues.list, {
    state: "all",
    per_page: 100,
  })
  for await (const { data } of iterator) {
    for (const issue of data) {
      if (!issue.pull_request) {
        issues.push({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          comment_count: issue.comments,
          repository: issue.repository?.name as string,
          author: issue.user?.login as string,
          url: issue.html_url,
        })
      }
    }
  }
  return issues
}

function getNotionOperations(issues) {
  const pagesToCreate: {}[] = []
  const pagesToUpdate: {}[] = []
  for (const issue of issues) {
    const pageId = gitHubIssuesIdToNotionPageId[issue.number]
    if (pageId) {
      pagesToUpdate.push({
        ...issue,
        pageId,
      })
    } else {
      pagesToCreate.push(issue)
    }
  }
  return { pagesToCreate, pagesToUpdate }
  
}

async function createPages(pagesToCreate) {
  const pagesToCreateChunks = _.chunk(pagesToCreate, OPERATION_BATCH_SIZE)
  for (const pagesToCreateBatch of pagesToCreateChunks) {
    await Promise.all(
      pagesToCreateBatch.map(issue =>
        notion.pages.create({
          parent: { database_id: issuesDB as string },
          properties: getPropertiesFromIssue(issue) as any,
        })
      )
    )
    console.log(`Completed batch size: ${pagesToCreateBatch.length}`)
  }
}

function getPropertiesFromIssue(issue) {
  const { title, repository, author, number, state, comment_count, url } = issue
  return {
    Name: {
      title: [{ type: "text", text: { content: title } }],
    },
    "ID": {
      number,
    },
    Repository: {
      title: [{ type: "text", text:  repository}],
      select: { name: repository },
    },
    Author: {
      select: { name: author },
    },
    State: {
      select: { name: state },
    },
    "Nb. Comments": {
      number: comment_count,
    },
    "Issue URL": {
      url,
    },
  }  
}

async function updatePages(pagesToUpdate) {
  const pagesToUpdateChunks: Array<any> = _.chunk(pagesToUpdate, OPERATION_BATCH_SIZE)
  for (const pagesToUpdateBatch of pagesToUpdateChunks) {
    await Promise.all(
      pagesToUpdateBatch.map(({ pageId, ...issue }) =>
        notion.pages.update({
          page_id: pageId,
          properties: getPropertiesFromIssue(issue) as any,
          archived: false
        })
      )
    )
    console.log(`Completed batch size: ${pagesToUpdateBatch.length}`)
  }
}