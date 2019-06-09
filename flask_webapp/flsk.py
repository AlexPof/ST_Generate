from flask import Flask
from flask import render_template
from flask import request
from flask import jsonify


import os
from random import sample
from datetime import datetime
import numpy as np
import json
import struct


################## MIDI-RELATED FUNCTIONS

def encodeVL(theint):
    """
        Encode an int as a variable-length format integer

        Inputs:
        - theint: integer to be encoded
        Outputs:
        - a list of bytes encoding the integer in variable-length format

    """

    for i in range(64)[::-1]:
        if ((theint>>i)&1):
            break
    numRelevantBits = i+1
    numBytes = (numRelevantBits + 6) // 7
    if (numBytes == 0):
        numBytes=1
    output=[]
    for i in range(numBytes)[::-1]:
        curByte = (int)(theint & 0x7F)

        if not (i == (numBytes - 1)):
            curByte |= 0x80
        output.append(curByte)
        theint >>= 7
    return output[::-1]

def writeMIDI(filepath,data):
    """

        General purpose function for generating MIDI file from real time-valued sound events data

        Inputs:
        - filepath: path of the MIDI file to be written (should include ".mid")
        - data: a dictionary containing multiple tracks, each track containing real time-valued sound events.
                The dictionary has one key, "tracks", whose value is a list of lists.
                Each list represents one track in the final MIDI file.
                The elements of each list are dictionaries representing a single sound event, each dictionary having the following keys:
                    - "type": "ON" or "OFF" (MIDI events 0x90 or 0x80)
                    - "note": integer value representing the note pitch
                    - "velocity": integer value representing the note velocity
                    - "time": float value representing the time in seconds

                Example:

                {
                    "tracks": [ [{"type":"OFF","note":62,"velocity":40,"time":5.067},
                                 {"type":"ON","note":62,"velocity":40,"time":2.067},
                                 {"type":"ON","note":62,"velocity":40,"time":7.067},
                                 {"type":"OFF","note":62,"velocity":40,"time":8.067}]
                                 ,
                                [{"type":"OFF","note":67,"velocity":40,"time":6.067},
                                 {"type":"ON","note":67,"velocity":40,"time":1.067},
                                 {"type":"ON","note":72,"velocity":40,"time":6.567},
                                 {"type":"OFF","note":72,"velocity":40,"time":12.067}]
                               ]
                }

        Outputs:
        - None. A MIDI file is written at filepath.

    """


    with open(filepath,"wb") as f:

        ## Writing the MIDI file header
        f.write(b"MThd")
        f.write(struct.pack(">ihhh",6,1,len(data["tracks"]),120)) # Length of the header, MIDI type 1, number of track, 120 ticks per quarter

        for x in data["tracks"]:
            # Reordering all the sound events by increasing time
            trackdata = [[y["type"],y["note"],y["velocity"],y["time"]] for y in x]
            trackdata = sorted(trackdata, key=lambda x:x[3])

            # MIDI files deal with time differences, which we calculate here
            trackdata_diff = [[trackdata[0][0],trackdata[0][1],trackdata[0][2],trackdata[0][3]]]
            for i in range(1,len(trackdata)):
                trackdata_diff.append([trackdata[i][0],trackdata[i][1],trackdata[i][2],trackdata[i][3]-trackdata[i-1][3]])
            trackdata_diff = [[x[0],x[1],x[2],encodeVL(int(240.*x[3]))] for x in trackdata_diff]

            # Number of bytes of the track chunk: 15 for standard info (120bpm, fake notes, etc.), 4 for the tail, the rest depends on the data
            trackdata_numbytes = 15+4+3*len(trackdata_diff)+sum([len(x[3]) for x in trackdata_diff])

            ## Writing the track chunk to the MIDI file
            f.write(b"MTrk")
            f.write(struct.pack(">i",trackdata_numbytes)) # Length of the track chunk

            # 120 bpm
            f.write(struct.pack(">BBBB",0,0xFF,0x51,0x03))
            f.write(struct.pack(">BBB",0x07,0xA1,0x20))


            # Fake note at the beginning to mark 0 time
            f.write(struct.pack(">BBBB",0,0x90,0,40))
            f.write(struct.pack(">BBBB",1,0x80,0,40))

            # Writing one note
            for x in trackdata_diff:
                for y in x[3]:
                    f.write(struct.pack(">B",y))
                if x[0]=="ON":
                    f.write(struct.pack(">BBB",0x90,x[1],x[2]))
                if x[0]=="OFF":
                    f.write(struct.pack(">BBB",0x80,x[1],x[2]))

            ## End of the track chunk
            f.write(struct.pack(">BBBB",0,0xFF,0x2F,0))

################## FLASK APP

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
    print(data)

    with open("./scores/"+data["filename"]+".json","r") as f:
        score_json = json.load(f)

    response_json = {"status":"ok","score":score_json}

    return jsonify(response_json)

@app.route('/generatemidi', methods = ['POST'])
def generatemidi():
    data = request.get_json()

    total = []

    for timepoints in data["all_timepoints"]:
        sorted_timepoints = sorted(timepoints,key=lambda x: x[3])
        c=0
        for note_type,midi_note,velocity,time in sorted_timepoints:
            if note_type == "ON":
                c+=1
                if c == 1:
                    total.append((note_type,midi_note,velocity,time))
            if note_type == "OFF":
                c-=1
                if c == 0:
                    total.append((note_type,midi_note,velocity,time))

    total=sorted(total,key=lambda x: x[3])
    min_time = min([x[3] for x in total])
    total = [{"type":x[0],"note":x[1],"velocity":x[2],"time":x[3]-min_time} for x in total]

    midi_data = {}
    midi_data["tracks"] = [total]

    writeMIDI("output_{:.2f}_{:.2f}_{:.2f}.mid".format(data["camera_x"],data["camera_y"],data["camera_angle"]),midi_data)

    response_json = {"status":"ok"}

    return jsonify(response_json)

@app.route('/save', methods = ['POST'])
def save():
    data = request.get_json()
    data["name"] = (data["name"].split('---')[0])+'---'+datetime.now().strftime("%Y-%m-%d--%H-%M")

    with open('./scores/{}.json'.format(data["name"]), 'w') as outfile:
        json.dump(data, outfile)

    response_json = {"status":"ok"}

    return jsonify(response_json)

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5006)
