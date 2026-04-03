# goderpad

sce conducts a cutting-edge industry pipeline through its summer internship program. this program draws upwards of one hundred applicants each year, requiring a hefty amount of interviews. goderpad simplifies the interview process by providing a centralized interview platform, allowing our hardworking internship mentors to focus on evaluation. 

## setup
1. copy `/config/config.example.yml` and create a `config.yml` file, then enter the config details for your setup
2. copy `.env.example` and create a `.env` file, then enter your environment variables for your setup

## how to run

just use docker it'll be so much easier trust me:
- dev mode: `docker compose -f docker-compose.dev.yml up --build`
- prod mode: `docker compose up --build -d`
note: to enable the code execution runner and redis, you'll have to manually enable code execution in `config/config.yml`, and run the app with a profile:  
`docker compose --profile code-execution up --build -d`

the frontend runs at `http://localhost:7777` and the backend runs at `http://localhost:7778`.

## production
https://sce.sjsu.edu/interview

currently supports react (frontend), python, javascript, java, c++