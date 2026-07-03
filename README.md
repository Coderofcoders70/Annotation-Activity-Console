# Annotation-Activity-Console
This full-stack application utilizes modern, persistent WebSockets for live AI data streaming and real-time synchronization. To preserve full socket integrity and avoid serverless connection drop-offs, the project is configured as a localized monorepo prototype. Full local setup commands are detailed below.

# For Backend
cd backend && npm install && npm start

# For Frontend
cd frontend && npm install && npm run dev

Included the DECISIONS.md file to show challenges and the strategies used to overcome all the problems and run the console successfully and smoothly.

Test Verification: Test pipelines are fully backed by unit tests using Jest, which can be verified instantly by running "npm run test" in the frontend directory.
