import json
import numpy as np
import struct
import sys

from reportlab.pdfgen import canvas
from reportlab.lib.units import inch, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from reportlab.lib.colors import Color

################## PDF DRAW

def drawLine(canvas, p1, p2, scale, rgba): 
    canvas.setStrokeColor(Color(rgba[0],rgba[1],rgba[2],alpha=rgba[3]))
    canvas.setFillColor(Color(rgba[0],rgba[1],rgba[2],alpha=rgba[3]))
    
    center_pagex = 21.0*cm/2.0
    center_pagey = 29.7*cm/2.0
    x1 = center_pagex+scale*p1[0]
    y1 = center_pagey+scale*p1[1]
    x2 = center_pagex+scale*p2[0]
    y2 = center_pagey+scale*p2[1]

    c.line(x1,y1,x2,y2)

def drawCircle(canvas, x, y, r, scale, rgba): 
    canvas.setStrokeColor(Color(rgba[0],rgba[1],rgba[2],alpha=1.0))
    canvas.setFillColor(Color(rgba[0],rgba[1],rgba[2],alpha=rgba[3]))
    
    center_pagex = 21.0*cm/2.0
    center_pagey = 29.7*cm/2.0
    x_cen = center_pagex+scale*x
    y_cen = center_pagey+scale*y
    r *= scale

    c.circle(x_cen, y_cen, r, stroke=1, fill=1)

def drawMultiString( canvas, x, y, scale, s ): 
    center_pagex = 21.0*cm/2.0
    center_pagey = 29.7*cm/2.0
    x_cen = center_pagex+scale*x
    y_cen = center_pagey+scale*y
    for ln in s.split('\n'): 
        c.drawString( x_cen, y_cen, ln ) 
        y_cen -= c._leading 

def rotate_point(x,y,angle):
    nx = x*np.cos(angle)+y*np.sin(angle)
    ny = -x*np.sin(angle)+y*np.cos(angle)
    return nx,ny

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

    alpha = np.arctan(nnx/(nny+focal))
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
    camera = [scale*camera[0],scale*camera[1],camera[2]]
    focal=focal*scale
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

data_filename="ST_28.json"
camera = (10.0,-15.0,20.0)

### Get data and generate projection

with open(data_filename) as data_file:    
    data = json.load(data_file)

    scale = data["cm_to_sec"]
    focal = float(data["focal"])

    for i,sound in enumerate(data["sounds"]):
        total=[]
        time_points = []
        for event in sound["events"]:
            for x in get_points(event,scale,camera,focal):
                time_points.append(x)

        time_points = sorted(time_points,key=lambda x: x[1])
        c=0
        for note_type,time in time_points:
            if note_type == "ON":
                c+=1
                if c == 1:
                    total.append((note_type,time))
            if note_type == "OFF":
                c-=1
                if c == 0:
                    total.append((note_type,time))       
        data["sounds"][i]["time_projections"] = sorted(total,key=lambda x:x[1])
    
    min_time =  min([min(y[1] for y in x["time_projections"]) for x in data["sounds"]])
    for i,sound in enumerate(data["sounds"]):
        data["sounds"][i]["time_projections"] = [(x,y-min_time) for x,y in data["sounds"][i]["time_projections"]]
    max_time =  max([max(y[1] for y in x["time_projections"]) for x in data["sounds"]])
    data["max_time"] = max_time

### Draw PDF
    
c = canvas.Canvas('ex.pdf')
pdfmetrics.registerFont(TTFont('TestFont', './Fonts/TasseRegular.ttf'))
c.setFont('TestFont',10)
c.setStrokeColorRGB(0.0,0.0,0.0)
c.setFillColorRGB(0.0,0.0,0.0)
c.setLineWidth(0.1)
display_scale = 12.

scale_maxtime = 21.*cm/data["max_time"]

drawCircle(c, camera[0], camera[1], 0.02, display_scale, (1.0,0.0,0.0,1.0))
drawLine(c, (camera[0],camera[1]),(camera[0]+80*np.cos(np.deg2rad(camera[2])),camera[1]+80*np.sin(np.deg2rad(camera[2]))), display_scale, (1.0,0.0,0.0,1.0))
drawLine(c, (camera[0],camera[1]),(camera[0]-80*np.cos(np.deg2rad(camera[2])),camera[1]-80*np.sin(np.deg2rad(camera[2]))), display_scale, (1.0,0.0,0.0,1.0))

drawCircle(c, camera[0]+focal*np.sin(np.deg2rad(camera[2])), camera[1]-focal*np.cos(np.deg2rad(camera[2])), 0.02, display_scale, (1.0,0.0,0.0,1.0))
c.setLineWidth(0.4)
drawLine(c, (camera[0],camera[1]), (camera[0]+focal*np.sin(np.deg2rad(camera[2])),camera[1]-focal*np.cos(np.deg2rad(camera[2]))), display_scale, (1.0,0.0,0.0,1.0))


for i,sound in enumerate(data["sounds"]):
    
    for proj1,proj2 in zip(sound["time_projections"][::2],sound["time_projections"][1::2]):
        t1 = proj1[1]
        t2 = proj2[1]
        c.setStrokeColorRGB(0.0,0.0,0.5)
        c.setFillColorRGB(0.0,0.0,0.5)

        c.line(t1*scale_maxtime,(0.5+0.1*i)*cm,t2*scale_maxtime,(0.5+0.1*i)*cm)
    
    for event in sound["events"]:
        
        if event["type"] == "Circle":
            x_cen,y_cen = event["parameters"]["center_x"],event["parameters"]["center_y"]
            r = event["parameters"]["diameter"]/2.0      
            drawCircle(c,x_cen, y_cen, r, display_scale, sound["color"])
            drawMultiString(c, x_cen,y_cen,display_scale, sound["name"])
            if not focal == float("Inf"):
                drawLine(c, (x_cen-r, y_cen), (camera[0]+focal*np.sin(np.deg2rad(camera[2])),camera[1]-focal*np.cos(np.deg2rad(camera[2]))), display_scale, sound["color"][:3]+[0.05])
                drawLine(c, (x_cen+r, y_cen), (camera[0]+focal*np.sin(np.deg2rad(camera[2])),camera[1]-focal*np.cos(np.deg2rad(camera[2]))), display_scale, sound["color"][:3]+[0.05])
            
        if event["type"] == "Bezier":
            pnames = ["start_x","start_y","end_x","end_y","control_start_x",
                  "control_start_y","control_end_x","control_end_y","spacing"]
            sx,sy,ex,ey,csx,csy,cex,cey,sp =  [event["parameters"][x] for x in pnames]
            
            b_x,b_y = sx,sy
            x_cen,y_cen = b_x,b_y
            drawCircle(c,x_cen, y_cen, 0.02, display_scale, sound["color"])
            if not focal == float("Inf"):
                drawLine(c, (x_cen, y_cen), (camera[0]+focal*np.sin(np.deg2rad(camera[2])),camera[1]-focal*np.cos(np.deg2rad(camera[2]))), display_scale, sound["color"][:3]+[0.05])
            
            for t in np.arange(0.0,1.0,1e-4):
                nb_x = sx*(1.0-t)**3+csx*3.0*t*(1.0-t)**2+cex*3.0*(t**2)*(1.0-t)+ex*t**3
                nb_y = sy*(1.0-t)**3+csy*3.0*t*(1.0-t)**2+cey*3.0*(t**2)*(1.0-t)+ey*t**3
                if np.linalg.norm([nb_x-b_x,nb_y-b_y])>sp:
                    b_x,b_y = nb_x,nb_y
                    x_cen,y_cen = b_x,b_y
                    drawCircle(c,x_cen, y_cen, 0.02, display_scale, sound["color"])
                    if not focal == float("Inf"):
                        drawLine(c, (x_cen, y_cen), (camera[0]+focal*np.sin(np.deg2rad(camera[2])),camera[1]-focal*np.cos(np.deg2rad(camera[2]))), display_scale, sound["color"][:3]+[0.05])
                    
        if event["type"] == "Point":
            x_cen,y_cen = event["parameters"]["x"],event["parameters"]["y"]
            drawCircle(c,x_cen, y_cen, 0.02, display_scale, sound["color"])
            if not focal == float("Inf"):
                drawLine(c, (x_cen, y_cen), (camera[0]+focal*np.sin(np.deg2rad(camera[2])),camera[1]-focal*np.cos(np.deg2rad(camera[2]))), display_scale, sound["color"][:3]+[0.05])


c.showPage()
c.save()


