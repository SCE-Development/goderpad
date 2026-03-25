# goderpad

sce conducts a cutting-edge industry pipeline through its summer internship program. this program draws upwards of one hundred applicants each year, requiring a hefty amount of interviews. goderpad simplifies the interview process by centralization, allowing our hardworking internship mentors to focus on evaluation. 

## setup
1. copy `/config/config.example.yml` and create a `config.yml` file. then enter your backend port (only used if you run without docker) and api key (for viewing past document saves), and ip address of the frontend on prod
2. copy `.env.example` and create a `.env` file, then enter your backend's prod ip and websocket ip, and api key.

## how to run

just use docker it'll be so much easier trust me: `docker compose -f docker-compose.dev.yml up --build`

the frontend runs at `http://localhost:7777` and the backend runs at `http://localhost:7778`.

## production
https://sce.sjsu.edu/interview

coming soon: support for more languages