### socket-based-File-sharing-system ###

Group 4 Lab Work Presentation
Presenting a Basic File-Sharing System
use case : Allows users to upload and download files.

### Steps To Run Project ###

Requirements: Python version 3.1x

1.Clone Project (git clone <repository_link>)

2.Installing Project Dependencies :
- open terminal in project working directory
- create python virtual environment (recommended) : python -m venv venv
- start/actiave environment :
    - on mac/linux : source venv/bin/activate
    - on windows : venv\bin\activate.bat
- install packages : pip install -r requirements.txt

3.Starting server
- uvicorn server:socket_app --reload --port 8000

4.Starting Client
- Open "http://127.0.0.1:5500/public/index.html" in browser to upload and download files
