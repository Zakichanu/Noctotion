# Noctotion

## Presentation
🐙 Github tool for listing some of your activity inside a database of Notion, made it in Typescript and I was inspired by this glitch [code](https://glitch.com/edit/#!/notion-github-sync?path=README.md%3A1%3A0), thanks a lot Notion team ! 


## Table of Contents


- Presentation
- Requirement
- Run the program
- Set-up on server


## Requirement

- Have a Notion [integration](https://www.notion.so/my-integrations) and retrieve the API KEY of it.
- Create a github API key, you can follow this [tutorial](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token), it's pretty easy
- Retrieve your ID of your issues database and put all 3 keys in a .env file like this : 
  ```sh
  GITHUB_KEY=<GITHUB KEY>
  NOTION_KEY=<NOTION KEY>
  NOTION_DATABASE_ID_ISSUES=<ID HERE>
  ```
- Don't forget to have a version of Node later than 16.
## Run the program

Now the requirement are done, you just have to do these things :
- Install typescript environment :
     - ```npm install -g typescript```
     - ```npm install -g ts-node```
     - ```npx tsc --init```
- Run ```npm install```
- And then you're good to go : ```npm start```


## Set-up on server

Personnally, I will do a crontab every X hour on my vps to refresh databases

> For now it is just issues activity but in the future, I will make more features available
