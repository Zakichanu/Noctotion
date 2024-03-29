# 🐙 Noctotion

## Presentation
Github tool for listing some of your activity inside a database of Notion, made it with Typescript and I was inspired by this glitch [code](https://glitch.com/edit/#!/notion-github-sync?path=README.md%3A1%3A0), thanks a lot Notion team ! 


## Table of Contents


- [Presentation](#presentation)
- [Requirement](#requirement)
- [Run the program](#run-the-program)
- [Set-up on server](#set-up-on-server)


## Requirement

- Have a Notion [integration](https://www.notion.so/my-integrations) and retrieve the API KEY of it.
- Create a github API key, you can follow this [tutorial](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token), it's pretty easy
- Retrieve your ID of your issues database and put all 3 keys in a ```.env``` file like this : 
  ```sh
  GITHUB_KEY=<GITHUB KEY>
  NOTION_KEY=<NOTION KEY>
  NOTION_DATABASE_ID_ISSUES=<ID HERE>
  NOTION_DATABASE_ID_PR=<ID HERE>
  ```
- Don't forget to have a version of Node later than 16.
- And also, don't forget to share your database to your Notion integration 😆 (got to do this mistake so many times)


## Run the program

Now the requirements are done, you just have to do these things :
- Install typescript environment :
     - ```npm install -g typescript```
     - ```npm install -g ts-node```
     - ```npx tsc --init```
- Run ```npm install```
- And then you're good to go : 
     - ```npm run dev``` on your local environment
     - ```npm start``` if you want to init a pm2 job running this script every 6 hours


## Set-up on server

Setting up on ```pm2``` while running ```npm start``` and this will run a cron job every 6 hours thanks to [node-cron module](https://www.npmjs.com/package/node-cron)
<br />
<br />
<br />
> For now it is just issues and PRs activity but in the future, I will make more features available
