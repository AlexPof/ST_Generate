from flask import Flask
from flask import render_template
from flask import request
from flask import jsonify

import os
from random import sample
from datetime import datetime
import numpy as np
import json

app = Flask(__name__)

@app.route('/')
def login_page():
    return render_template('essai.html')

@app.route('/getfiles', methods = ['POST'])
def getfiles():
    filelist = [x.split(".json",1)[0] for x in os.listdir("./scores/") if ".json" in x]

    response_json = {"status":"ok","filelist":filelist}

    return jsonify(response_json)
    
@app.route('/readfile', methods = ['POST'])
def readfile():
    data = request.get_json()

    with open("./scores/"+data["filename"]+".json","r") as f:
        score_json = json.load(f)

    response_json = {"status":"ok","score":score_json}

    return jsonify(response_json)

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5006)
