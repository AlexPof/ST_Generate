import json
import numpy as np
import struct
import sys

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
    numBytes = (numRelevantBits + 6) / 7
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
        f.write("MThd")
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
            f.write("MTrk")
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

            
################## CAMERA PROJECTIONS

def get_circleprojection(camera,point,radius,focal):
    """
        camera : (xc,yc,angle) coordinates of the center of the projection plane, and its angle (in degrees)
        point : (x,y) coordinates of the center of the circle to be projected
        radius : radius of the circle to be projected
        focal : float value for the projection focal
    """
    xc,yc,angle = camera
    angle = np.deg2rad(angle)
    x,y = point

    nx = x-xc
    ny = y-yc

    nnx = nx*np.cos(angle)+ny*np.sin(angle)
    nny = -nx*np.sin(angle)+ny*np.cos(angle)

    alpha = np.arctan((nny+focal)/nnx)
    theta = np.arcsin(radius/np.linalg.norm([nnx,nny+focal]))

    p1_x = nnx-radius*np.cos(alpha-theta)
    p1_y = nny+radius*np.sin(alpha-theta)
    p2_x = nnx+radius*np.cos(alpha+theta)
    p2_y = nny-radius*np.sin(alpha+theta)
    
    proj = [p1_x/(1.0+p1_y/focal),p2_x/(1.0+p2_y/focal)]

    return min(proj),max(proj)
            
def get_pointprojection(camera,point,focal):
    """
        camera : (xc,yc,angle) coordinates of the center of the projection plane, and its angle (in degrees)
        point : (x,y) coordinates of the point to be projected
        focal : float value for the projection focal
    """
    xc,yc,angle = camera
    angle = np.deg2rad(angle)
    x,y = point

    nx = x-xc
    ny = y-yc
    nnx = nx*np.cos(angle)+ny*np.sin(angle)
    nny = -nx*np.sin(angle)+ny*np.cos(angle)

    return nnx/(1.0+nny/focal)

def get_points(event,scale,camera,focal):
    """
        event : dictionary describing the geometry of the event
    """
    time_points = []
    if event["type"]=="Circle":
        x,y,d = scale*event["parameters"]["center_x"],scale*event["parameters"]["center_y"],scale*event["parameters"]["diameter"]
        time_start,time_end = get_circleprojection(camera,(x,y),d/2.0,focal)
        time_points.append(("ON",time_start))
        time_points.append(("OFF",time_end))
        
    elif event["type"]=="Point":
        x,y = scale*event["parameters"]["x"],scale*event["parameters"]["y"]
        time = get_pointprojection(camera,(x,y),focal)
        time_points.append(("ON",time))
        time_points.append(("OFF",time+0.01))
        
    elif event["type"]=="Bezier":
        pnames = ["start_x","start_y","end_x","end_y","control_start_x",
                  "control_start_y","control_end_x","control_end_y","spacing"]
        sx,sy,ex,ey,csx,csy,cex,cey,sp =  [scale*event["parameters"][x] for x in pnames]
        
        b_x,b_y = sx,sy
        time = get_pointprojection(camera,(b_x,b_y),focal)
        time_points.append(("ON",time))
        time_points.append(("OFF",time+0.01))
        
        for t in np.arange(0.0,1.0,1e-4):
            nb_x = sx*(1.0-t)**3+csx*3.0*t*(1.0-t)**2+cex*3.0*(t**2)*(1.0-t)+ex*t**3
            nb_y = sy*(1.0-t)**3+csy*3.0*t*(1.0-t)**2+cey*3.0*(t**2)*(1.0-t)+ey*t**3
            if np.linalg.norm([nb_x-b_x,nb_y-b_y])>sp:
                b_x,b_y = nb_x,nb_y
                time = get_pointprojection(camera,(b_x,b_y),focal)
                time_points.append(("ON",time))
                time_points.append(("OFF",time+0.01))
                
    return time_points

################## MAIN

data_filename = sys.argv[1]
angle_start = float(sys.argv[2])
angle_end = float(sys.argv[3])
num_angles = float(sys.argv[4])

with open(data_filename) as data_file:    
    data = json.load(data_file)

    scale = data["cm_to_sec"]
    focal = float(data["focal"])

    for angle in np.linspace(angle_start,angle_end,num_angles):
        print "Processing ",data["name"]," at angle ",angle

        total=[]

        for sound in data["sounds"]:    
            for event in sound["events"]:
                time_points = get_points(event,scale,(0.0,0.0,angle),focal)
                time_points = sorted(time_points,key=lambda x: x[1])
                c=0
                for note_type,time in time_points:
                    if note_type == "ON":
                        c+=1
                        if c == 1:
                            total.append((note_type,sound["midi_note"],event["velocity"],time))
                    if note_type == "OFF":
                        c-=1
                        if c == 0:
                            total.append((note_type,sound["midi_note"],event["velocity"],time))
                            
        total=sorted(total,key=lambda x: x[1])
        min_time = min([x[3] for x in total])
        total = [{"type":x[0],"note":x[1],"velocity":x[2],"time":x[3]-min_time} for x in total]

        midi_data = {}
        midi_data["tracks"] = [total]
        writeMIDI("output-"+str(angle)+".mid",midi_data)
