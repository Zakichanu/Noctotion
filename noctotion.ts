import _ from 'lodash'; // Import lodash
import { Client } from '@notionhq/client'; // Import Notion Client
import dotenv from 'dotenv'; // Import dotenv
import { Octokit } from 'octokit'; // Import octokit
import cron from 'node-cron';


// Initialize variables
dotenv.config();
const octokit = new Octokit({ auth: process.env.GITHUB_KEY });
const notion = new Client({ auth: process.env.NOTION_KEY }); // Initialize notion client

const issuesDB = process.env.NOTION_DATABASE_ID_ISSUES;
const pullRequestDB = process.env.NOTION_DATABASE_ID_PR;
const OPERATION_BATCH_SIZE = 50;

const gitHubIssuesIdToNotionPageId: {}[] = [] // Maps GitHub issue numbers to Notion page IDs
const gitHubPRsIdToNotionPageId: {}[] = [] // Maps GitHub PRs numbers to Notion page IDs

// Boolean for testing purposes.
let codeIsRunning: boolean = true;



// Get issues already stored on Notion DB and then sync with github ones
try {
  console.log("App Running")
  if (process.env.NODE_ENV === 'production') {
    cron.schedule('0 */6 * * *', async () => {
      setInitialGitHubToNotionIdMap().then(syncNotionDatabaseWithGitHub)
    })
  } else if (process.env.NODE_ENV === 'development') {
    setInitialGitHubToNotionIdMap().then(syncNotionDatabaseWithGitHub)
  }
} catch (err) {
  codeIsRunning = false;
  console.log(err)
}




// Get all issues and PR from notion databases so then we can know if we have to add some pages or not
async function setInitialGitHubToNotionIdMap() {
  const stockedIssues = await getIssuesFromNotionDatabase();
  for (const { pageId, url } of stockedIssues) {
    gitHubIssuesIdToNotionPageId[url] = pageId;
  }

  const stockedPRs = await getPullRequestsFromNotionDatabase();
  for (const { pageId, url } of stockedPRs) {
    gitHubPRsIdToNotionPageId[url] = pageId;
  }
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

  const pageMap = pages.map(async (page: any) => {
    const propertyItem = await getPropertyValue(page.id, page.properties["URL"].id);
    return {
      pageId: page.id,
      url: propertyItem!.url 
    }
    
  })
  return Promise.all(pageMap); 
}

// Function to get the value of property url from a pageId
async function getPropertyValue( pageId: any, propertyId: any ) {
  const propertyItem = await notion.pages.properties.retrieve({
    page_id: pageId,
    property_id: propertyId,
  }) 
  if (propertyItem.object === "property_item" && propertyItem.type === "url") {
    return propertyItem
  }
  return null;
}

// Retrieve pull requests in notion database.
async function getPullRequestsFromNotionDatabase() {
  const pages = [] as any;
  let cursor: string | undefined;
  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: pullRequestDB as string,
      start_cursor: cursor,
    })
    pages.push(...results)
    if (!next_cursor) {
      break;
    }
    cursor = next_cursor;
  }
  console.log(`${pages.length} pull requests successfully fetched.`)
  const pageMap = pages.map(async (page: any) => {
    const propertyItem = await getPropertyValue(page.id, page.properties["URL"].id);
    return {
      pageId: page.id,
      url: propertyItem!.url 
    }
    
  })

  // Wait for list to complete
  return Promise.all(pageMap); 
}

// Retrieve issues from GitHub API and sync with the one present on Notion
async function syncNotionDatabaseWithGitHub() {

  // Get all issues currently assigned to process.env.GITHUB_USER
  console.log("\nFetching issues from Notion DB...")
  const issues = await getGitHubIssuesAssigned()
  console.log(`Fetched ${issues.length} issues from GitHub repository.`)

  // Group issues into those that need to be created or updated in the Notion database.
  const { pagesToCreateIssues, pagesToUpdateIssues } = getNotionOperations(issues, 'issues');

  // Create pages for new issues.
  console.log(`\n${pagesToCreateIssues.length} new issues to add to Notion.`)
  await createPages(pagesToCreateIssues, issuesDB as string)

  // Updates pages for existing issues.
  console.log(`\n${pagesToUpdateIssues.length} issues to update in Notion.`)
  await updatePages(pagesToUpdateIssues)

  // Get all PRs currently in the provided .
  console.log("\nFetching PRs from Notion DB...")
  const pullRequests = await getGitHubPRForOwningRepo();
  console.log(`Fetched ${pullRequests.length} pull requests from Notion DB.`);

  // Group PRs into those that need to be created or updated in the Notion database.
  const { pagesToCreatePRs, pagesToUpdatePRs } = getNotionOperations(pullRequests, 'pr');

  // Create pages for new PRs.
  console.log(`\n${pagesToCreatePRs.length} new PRs to add to Notion.`)
  await createPages(pagesToCreatePRs, pullRequestDB as string);

  // Updates pages for existing PRs.
  console.log(`\n${pagesToUpdatePRs.length} PRs to update in Notion.`)
  await updatePages(pagesToUpdatePRs)

  // Success!
  console.log("\n✅ Notion database is synced with GitHub.")
}



// Retrieve all repositories that I am assigned as an owner or collaborator
async function getOwningRepositories() {
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: 'owner,collaborator',
  });
  return repos
}




// Getting issues that I am assigned to (or your github username)
async function getGitHubIssuesAssigned() {
  const issues: { number: number, title: string, state: string, url: string, repository: string, author: string, dates: string }[] = []
  const iterator = octokit.paginate.iterator(octokit.rest.issues.list, {
    state: "all",
    per_page: 100,
  })
  for await (const { data } of iterator) {
    for (const issue of data) {
      if (!issue.pull_request) {
        // Adapt the date function to the state of issue
        const datesInserted: string = issue.state === "open" ? issue.updated_at : issue.closed_at!

        issues.push({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          repository: issue.repository?.name as string,
          dates: datesInserted,
          author: issue.user?.login as string,
          url: issue.html_url,
        })
      }
    }
  }
  return issues
}

// Get all PRs that I am the owner (or your github username)
async function getGitHubPRForOwningRepo() {
  const pullRequest: { number: number, title: string, state: string, url: string, repository: string, author: string, dates: string }[] = []

  // List of all repositories where I am the owner or a collaborator
  const repos = await getOwningRepositories();

  for (const repo of repos) {
    // Get all PRs for each repository
    const iterator = octokit.paginate.iterator(octokit.rest.pulls.list, {
      state: "all",
      per_page: 100,
      owner: repo.owner.login,
      repo: repo.name,
    })
    for await (const { data } of iterator) {
      for (const pr of data) {
        // Adapt the date function to the state of PR
        const datesInserted: string = pr.state === "open" ? pr.updated_at : pr.closed_at!
        pullRequest.push({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          repository: repo.name,
          author: pr.user?.login as string,
          dates: datesInserted,
        });

      }
    }
  }
  console.log(pullRequest.length);
  return pullRequest;
}

// Retreieve all operation to make in notion databases
function getNotionOperations(activity: any, activityString: string) {
  const pagesToCreateIssues: {}[] = []
  const pagesToUpdateIssues: {}[] = []
  const pagesToCreatePRs: {}[] = []
  const pagesToUpdatePRs: {}[] = []
  for (const act of activity) { 
    if (activityString === 'issues') {
      const pageId = gitHubIssuesIdToNotionPageId[act.url]
      if (pageId) {
        pagesToUpdateIssues.push({
          ...act,
          pageId,
        })
      } else {
        pagesToCreateIssues.push(act)
      } 
    } else {
      const pageId = gitHubPRsIdToNotionPageId[act.url]
      if (pageId) {
        pagesToUpdatePRs.push({
          ...act,
          pageId, 
        })
      } else {
        pagesToCreatePRs.push(act)
      }
    }

  }
  return { pagesToCreateIssues, pagesToUpdateIssues, pagesToCreatePRs, pagesToUpdatePRs }

}

// Create pages for new issues and PRs
async function createPages(pagesToCreate: any, dbToTarget: string) {
  const pagesToCreateChunks = _.chunk(pagesToCreate, OPERATION_BATCH_SIZE)
  for (const pagesToCreateBatch of pagesToCreateChunks) {
    await Promise.all(
      pagesToCreateBatch.map((activity: any) =>
        notion.pages.create({
          parent: { database_id: dbToTarget },
          properties: getPropertiesFromIssueAndPR(activity) as any,
        })
      )
    )
    console.log(`Completed batch size: ${pagesToCreateBatch.length}`)
  }
}

// Properties of DB
function getPropertiesFromIssueAndPR(activity: any) {
  const { title, repository, author, number, state, url, dates } = activity
  return {
    Name: {
      title: [{ type: "text", text: { content: title } }],
    },
    "ID": {
      number,
    },
    Repository: {
      select: { name: repository },
    },
    Author: {
      select: { name: author },
    },
    State: {
      select: { name: state },
    },
    "URL": {
      url,
    },
    Date: {
      "date": { "start": dates },
    },
  }
}

// Update pages for existing issues and PRs
async function updatePages(pagesToUpdate: any) {
  const pagesToUpdateChunks: Array<any> = _.chunk(pagesToUpdate, OPERATION_BATCH_SIZE)
  for (const pagesToUpdateBatch of pagesToUpdateChunks) {
    await Promise.all(
      pagesToUpdateBatch.map(({ pageId, ...activity }: { pageId: any }) =>
        notion.pages.update({
          page_id: pageId,
          properties: getPropertiesFromIssueAndPR(activity) as any,
          archived: false
        })
      )
    )
    console.log(`Completed batch size: ${pagesToUpdateBatch.length}`)
  }
}

export default { codeIsRunning }