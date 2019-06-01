
var CURRENT_FILE;
var CM_TO_SEC;
var SOUNDS_LIST;
var SCREEN_SCALING=50;
var CURRENT_SELECTION;

$.ajax({
        url: '/getfiles',
        dataType: 'json',
        type: 'post',
        contentType: 'application/json',
        data: JSON.stringify({}),
        processData: false,
        success: function(response, textStatus, jqXHR) {
			filelist = response.filelist;
			var the_html=""
			for (var i = 0; i < filelist.length; i++) {
				the_html+='<a href="#" class="list-group-item list-group-item-action" style="font-size:12px; height: 40px;" id="'+filelist[i]+'">';
				the_html+=filelist[i]+"</a>";
			}
			$("#files").html(the_html);
			for(i=0;i<filelist.length;i++) {
				$("#"+filelist[i]).on("click",
									  {index:filelist[i]},
									   function(event){
										  $("#"+CURRENT_FILE).attr("class","list-group-item list-group-item-action");
										  CURRENT_FILE = event.data.index;
										  $("#"+event.data.index).attr("class","list-group-item list-group-item-action active");
										  get_score(CURRENT_FILE);
										});
			}
        },
        error: function(response, textStatus, jqXHR) {console.log("Fail");}
      });

function get_score(filename) {
$.ajax({
        url: '/readfile',
        dataType: 'json',
        type: 'post',
        contentType: 'application/json',
        data: JSON.stringify({"filename":CURRENT_FILE}),
        processData: false,
        success: function(response, textStatus, jqXHR) {
                  			d3.selectAll(".elements-circle").remove();
                  			d3.selectAll(".elements-point").remove();
                        d3.selectAll(".elements-bezier").remove();

                  			score = response.score;
                        CM_TO_SEC = score.cm_to_sec/SCREEN_SCALING;
                        SOUNDS_LIST = {};
                        d3.select("#sounds").selectAll("*").remove();

                  			for(i=0;i<score.sounds.length;i++) {
                  				sounds = score.sounds[i];
                          SOUNDS_LIST[i] = {"midi_note":sounds.midi_note,"name":sounds.name,"color":sounds.color};

                          var the_div = d3.select("#sounds").append("div")
                                              .attr("width","50")
                                              .attr("style","font-size: 10px;border: 1px solid lightgray; border-radius: 4px;")
                                              .datum({"sound_index":i});

                          the_div.append("div")
                                 .html("▲ Name: " +sounds.name)
                                 .on("click", function(d) {
                                                 var parentNode = d3.select(this.parentNode);
                                                 var subdiv = parentNode.select("#description");
                                                 var toggling_char = subdiv.style("visibility")=="hidden" ? "▼" : "▲";
                                                 d3.select(this).html(toggling_char+" Name: " +SOUNDS_LIST[d.sound_index].name);
                                                 subdiv.style("visibility",(subdiv.style("visibility")=="hidden") ? "visible" : "hidden");
                                               });

                          var submenu = the_div.append("div").attr("id","description").style("visibility","hidden");
                          var addcircle_svg = submenu.append("svg")
                                                     .on("click", function(d) {
                                                          add_circle({"parameters":{"center_x":0.0,"center_y":0.0,"diameter":1.0}},d.sound_index);
                                                      })
                                                     .attr("width",25)
                                                     .attr("height",25);
                        addcircle_svg.append("circle")
                                 .attr("cx",12)
                                 .attr("cy",12)
                                 .attr("r",8)
                                 .attr("fill","rgb("+sounds.color[0]+","+sounds.color[1]+","+sounds.color[2]+")");
                        var addpoint_svg = submenu.append("svg")
                                                   .on("click", function(d) {
                                                      add_point({"parameters":{"x":0.0,"y":0.0}},d.sound_index);
                                                   })
                                                   .attr("width",25)
                                                   .attr("height",25);
                        addpoint_svg.append("circle")
                               .attr("cx",12)
                               .attr("cy",12)
                               .attr("r",5)
                               .attr("fill","rgb("+sounds.color[0]+","+sounds.color[1]+","+sounds.color[2]+")");
                      addpoint_svg.append("circle")
                               .attr("cx",12)
                               .attr("cy",12)
                               .attr("r",1)
                               .attr("fill","black");
                      var addbezier_svg = submenu.append("svg")
                                          .on("click", function(d) {
                                             add_bezier({"parameters":{"start_x":0.0,"start_y":0.0,
                                                                       "control_start_x":0.0,"control_start_y":5.0,
                                                                       "control_end_x":5.0,"control_end_y":5.0,
                                                                       "end_x":5.0,"end_y":0.0,
                                                                       "spacing":0.25
                                                                      }},d.sound_index);
                                          })
                                          .attr("width",25)
                                          .attr("height",25);

                      addbezier_svg.append("path")
                              .attr("d","M 0,20 C 10,0 15,20 20,7")
                              .attr("stroke","rgb("+sounds.color[0]+","+sounds.color[1]+","+sounds.color[2]+")")
                              .attr("stroke-width","2")
                              .attr("fill","none");

                  				for(j=0;j<sounds.events.length;j++) {
                  					events = sounds.events[j];
                  					if (events.type=="Circle") { add_circle(events,i); }
                  					if (events.type=="Point") { add_point(events,i); }
                            if (events.type=="Bezier") { add_bezier(events,i); }
                  				}
			                  }
                },
        error: function(response, textStatus, jqXHR) {console.log("Fail");}
      });
}

var SHIFT_DOWN=false;
var CTRL_DOWN=false;
var camera_x = 0;
var camera_y = 0;
var focal_x = 0;
var focal_y = 20;
var cam_focus_x = -20;
var cam_focus_y = -20;

d3.select('body').on('keydown', function() {
                                        switch(d3.event.keyCode) {
                                          case 16:
                                            SHIFT_DOWN=true;
                                            break;
                                          case 17:
                                            CTRL_DOWN=true;
                                            break;
                                          case 8:
                                            if (CURRENT_SELECTION != null) {
                                              CURRENT_SELECTION.remove();
                                              CURRENT_SELECTION = null;
                                            }
                                            recalculate();
                                            break;
                                        }
                                      })
                      .on('keyup', function() {
                                        switch(d3.event.keyCode) {
                                          case 16:
                                            SHIFT_DOWN=false;
                                          case 17:
                                            CTRL_DOWN=false;
                                      }
                                      });

var width=800;
var height=600;

var SVG = d3.select("#coregraph").append("svg")
		.attr("width", width)
		.attr("height", height);



var graphix = SVG.append("g")
				 .attr("transform", "translate(" + width/2 + "," + height/2 + ")");

graphix.append("rect")
     .attr("class", "overlay")
	   .attr("x",-width/2)
	   .attr("y",-height/2)
     .attr("width", width)
     .attr("height", height);



var graphix2 = graphix.append("g");

var projection_SVG = d3.select("#projection").append("svg")
    .attr("width", 1000)
    .attr("height", 500)
    .append("g")
    .attr("transform", "translate(" + 1000/2 + "," + 250 + ")");

projection_SVG.append("rect")
    .attr("class", "overlay")
    .attr("x",-1000/2)
    .attr("y",-250)
    .attr("width", width)
    .attr("height", 250);

var graphix_proj = projection_SVG.append("g");

var zoom_handler = d3.zoom()
          .on("zoom", function zoom_actions(){graphix2.attr("transform", d3.event.transform);  if (CURRENT_SELECTION != null) { CURRENT_SELECTION.attr("style","outline: none;"); } CURRENT_SELECTION=null;
                                             });
graphix.call(zoom_handler);

var zoom_handler_projection = d3.zoom()
          .on("zoom", function zoom_actions(){graphix_proj.attr("transform", d3.event.transform);
                                             });
projection_SVG.call(zoom_handler_projection);



graphix2.append("line").attr("x1",-10000).attr("x2",10000).attr("y1",0).attr("y2",0).attr("stroke","lightgray").attr("stroke-dasharray",10);
graphix2.append("line").attr("y1",-10000).attr("y2",10000).attr("x1",0).attr("x2",0).attr("stroke","lightgray").attr("stroke-dasharray",10);

camera_line = graphix2.append("line").attr("id","camera_line")
					  .attr("x1",camera_x)
					  .attr("x2",focal_x)
					  .attr("y1",camera_y)
					  .attr("y2",focal_y)
					  .attr("stroke","lightsteelblue");
camera_focusline = graphix2.append("line").attr("id","camera_focusline")
					  .attr("x1",camera_x)
					  .attr("x2",cam_focus_x)
					  .attr("y1",camera_y)
					  .attr("y2",cam_focus_y)
					  .attr("stroke","lightsteelblue")
            .attr("visibility","hidden");
camera_eye = graphix2.append("circle").attr("class","camera")
		.attr("cx",camera_x)
		.attr("cy",camera_y)
		.attr("r",12)
		.attr("stroke","darkgray")
		.attr("fill","cyan");
camera_focal = graphix2.append("circle").attr("class","camera")
		.attr("cx",focal_x)
		.attr("cy",focal_y)
		.attr("r",12)
		.attr("stroke","darkgray")
		.attr("fill","pink");

camera_focus = graphix2.append("circle").attr("id","camera_focus")
		.attr("cx",cam_focus_x)
		.attr("cy",cam_focus_y)
		.attr("r",12)
		.attr("stroke","darkgray")
		.attr("fill","gray")
    .attr("visibility","hidden");

camera_eye.call(d3.drag().on("drag", dragged_camera));
camera_focal.call(d3.drag().on("drag", dragged_focal));
camera_focus.call(d3.drag().on("drag", dragged_cam_focus));

function add_point(sound_event,sound_index) {
  x = SCREEN_SCALING*sound_event.parameters.x;
  y = SCREEN_SCALING*sound_event.parameters.y;
  the_point = graphix2.append("g").attr("class","elements-point").attr("transform", "translate(" + x + "," + y+")");
  the_point.datum({"x":x,"y":y,"sound_index":sound_index});

  the_point.append("circle")
           .attr("cx",0)
           .attr("cy",0)
           .attr("r",5)
           .attr("stroke","black")
           .attr("fill","rgb("+SOUNDS_LIST[sound_index].color[0]+","+SOUNDS_LIST[sound_index].color[1]+","+SOUNDS_LIST[sound_index].color[2]+")")
           .attr("opacity",0.6);
 the_point.append("circle")
           .attr("cx",0)
           .attr("cy",0)
           .attr("r",0.5)
           .attr("fill","black")
           .attr("opacity",0.6);
  the_point.call(d3.drag().on("drag", dragged_point));
}

function add_circle(sound_event,sound_index) {
  x = SCREEN_SCALING*sound_event.parameters.center_x;
  y = SCREEN_SCALING*sound_event.parameters.center_y;
  r = SCREEN_SCALING*sound_event.parameters.diameter/2;

  var the_circle = graphix2.append("g").attr("class","elements-circle").attr("transform", "translate(" + x + "," + y+")");
  the_circle.datum({"center_x":x,"center_y":y,"r":r,"sound_index":sound_index});

  var inside_circ = the_circle.append("circle")
       .attr("cx",0)
       .attr("cy",0)
       .attr("r",r)
       .attr("stroke","lightgray")
       .attr("stroke-width",0.01)
       .attr("fill","rgb("+SOUNDS_LIST[sound_index].color[0]+","+SOUNDS_LIST[sound_index].color[1]+","+SOUNDS_LIST[sound_index].color[2]+")")
       .attr("opacity",0.2)
       .call(d3.drag().on("drag", dragged_circle));
}

function add_bezier(sound_event,sound_index) {
  var start_x = SCREEN_SCALING*sound_event.parameters.start_x;
  var start_y = SCREEN_SCALING*sound_event.parameters.start_y;
  var end_x = SCREEN_SCALING*sound_event.parameters.end_x;
  var end_y = SCREEN_SCALING*sound_event.parameters.end_y;
  var control_start_x = SCREEN_SCALING*sound_event.parameters.control_start_x;
  var control_start_y = SCREEN_SCALING*sound_event.parameters.control_start_y;
  var control_end_x = SCREEN_SCALING*sound_event.parameters.control_end_x;
  var control_end_y = SCREEN_SCALING*sound_event.parameters.control_end_y;
  var spacing = SCREEN_SCALING*sound_event.parameters.spacing;

  the_bezier = graphix2.append("g").attr("class","elements-bezier").attr("transform", "translate(" + start_x + "," + start_y + ")");
  the_bezier.datum({"start_x":start_x,
                    "start_y":start_y,
                    "end_x":end_x,
                    "end_y":end_y,
                    "control_start_x":control_start_x,
                    "control_start_y":control_start_y,
                    "control_end_x":control_end_x,
                    "control_end_y":control_end_y,
                    "spacing":spacing,
                    "sound_index":sound_index,
                  });
  the_bezier.append("path").attr("id","bezier_path");
  the_bezier.append("line").attr("id","control_start_line");
  the_bezier.append("line").attr("id","control_end_line");
  the_bezier.append("circle").attr("id","start_circle");
  the_bezier.append("circle").attr("id","end_circle");
  the_bezier.append("circle").attr("id","control_start_circle");
  the_bezier.append("circle").attr("id","control_end_circle");
  set_bezier_curve(the_bezier);
  the_bezier.select("#start_circle").call(d3.drag().on("drag", dragged_bezierstart));
  the_bezier.select("#control_start_circle").call(d3.drag().on("drag", dragged_beziercontrolstart));
  the_bezier.select("#control_end_circle").call(d3.drag().on("drag", dragged_beziercontrolend));
  the_bezier.select("#end_circle").call(d3.drag().on("drag", dragged_bezierend));
}

function set_bezier_curve(g_element) {
  d = g_element.datum();

  var points_x = new Array();
  var points_y = new Array();
  var cur_x = d.start_x;
  var cur_y = d.start_y;
  var cum_L=0.0;
  for (t=0;t<1;t+=0.001) {
      var new_x = (1-t)*(1-t)*(1-t)*d.start_x+3*t*(1-t)*(1-t)*d.control_start_x+3*t*t*(1-t)*d.control_end_x+t*t*t*d.end_x;
      var new_y = (1-t)*(1-t)*(1-t)*d.start_y+3*t*(1-t)*(1-t)*d.control_start_y+3*t*t*(1-t)*d.control_end_y+t*t*t*d.end_y;
      cum_L += Math.sqrt((new_x-cur_x)*(new_x-cur_x)+(new_y-cur_y)*(new_y-cur_y));
      if (cum_L>d.spacing) {
        points_x.push(new_x);
        points_y.push(new_y);
        cum_L=0.0;
      }
      cur_x=new_x;
      cur_y=new_y;
  }

  d.points_x = points_x;
  d.points_y = points_y;
  g_element.datum(d);

  g_element.select("#bezier_path")
              .attr("d","M 0,0  C "+(d.control_start_x-d.start_x)+","+(d.control_start_y-d.start_y)+" "+(d.control_end_x-d.start_x)+","+(d.control_end_y-d.start_y)+" "+(d.end_x-d.start_x)+","+(d.end_y-d.start_y))
              .attr("stroke","rgb("+SOUNDS_LIST[d.sound_index].color[0]+","+SOUNDS_LIST[d.sound_index].color[1]+","+SOUNDS_LIST[d.sound_index].color[2]+")")
              .attr("fill","none")
              .attr("stroke-width",4)
              .attr("stroke-dasharray","4,"+d.spacing);
  g_element.select("#control_start_line")
            .attr("x1",0)
            .attr("x2",d.control_start_x-d.start_x)
            .attr("y1",0)
            .attr("y2",d.control_start_y-d.start_y)
            .attr("stroke","lightsteelblue");
  g_element.select("#control_end_line")
            .attr("x1",d.control_end_x-d.start_x)
            .attr("x2",d.end_x-d.start_x)
            .attr("y1",d.control_end_y-d.start_y)
            .attr("y2",d.end_y-d.start_y)
            .attr("stroke","lightsteelblue");

  g_element.select("#start_circle")
             .attr("cx",0)
             .attr("cy",0)
             .attr("r",5)
             .attr("stroke","black")
             .attr("fill","darkblue")
             .attr("opacity",0.4);
   g_element.select("#control_start_circle")
             .attr("cx",d.control_start_x-d.start_x)
             .attr("cy",d.control_start_y-d.start_y)
             .attr("r",5)
             .attr("stroke","black")
             .attr("fill","gray")
             .attr("opacity",0.4);
   g_element.select("#control_end_circle")
             .attr("cx",d.control_end_x-d.start_x)
             .attr("cy",d.control_end_y-d.start_y)
             .attr("r",5)
             .attr("stroke","black")
             .attr("fill","gray")
             .attr("opacity",0.4);
   g_element.select("#end_circle")
             .attr("cx",d.end_x-d.start_x)
             .attr("cy",d.end_y-d.start_y)
             .attr("r",5)
             .attr("stroke","black")
             .attr("fill","gray")
             .attr("opacity",0.4);
}

function dummy_drag(d) {
  console.log(d3.event.x,d3.event.y);
}

function dragged_circle(d) {
  var circle = d3.select(this.parentNode);
  if (CURRENT_SELECTION != null) { CURRENT_SELECTION.attr("style","outline: none;"); }
  CURRENT_SELECTION = circle;
  CURRENT_SELECTION.attr("style","outline: 1px dashed lightgray; outline-offset: 3px;")

  new_d = circle.datum();
	center_x = new_d.center_x;
	center_y = new_d.center_y;
	r = new_d.r;

	if (SHIFT_DOWN) {
		new_r = Math.sqrt(d3.event.x*d3.event.x+d3.event.y*d3.event.y);
		circle.selectAll("circle").attr("r",new_r);
    new_d.r = new_r;
    circle.datum(new_d);
	} else {
    new_d.center_x = d3.event.x+center_x;
    new_d.center_y = d3.event.y+center_y;
		circle.attr("transform", "translate(" + new_d.center_x + "," + new_d.center_y + ")");
    circle.datum(new_d);
	}

	 recalculate();
}

function dragged_point(d) {
	 d3.select(this).attr("transform", "translate(" + d3.event.x + "," + d3.event.y+")");
   if (CURRENT_SELECTION != null) { CURRENT_SELECTION.attr("style","outline: none;"); }
   CURRENT_SELECTION = d3.select(this);
   CURRENT_SELECTION.attr("style","outline: 1px dashed lightgray; outline-offset: 3px;")
   d.x = d3.event.x;
   d.y = d3.event.y;
	 recalculate();
}

function dragged_bezierstart(d) {
   var bezier = d3.select(this.parentNode);
    if (CURRENT_SELECTION != null) { CURRENT_SELECTION.attr("style","outline: none;"); }
   CURRENT_SELECTION = bezier;
   CURRENT_SELECTION.attr("style","outline: 1px dashed lightgray; outline-offset: 3px;")
   new_d = bezier.datum();

   if (SHIFT_DOWN) {
     new_d.start_x = d3.event.x+new_d.start_x;
     new_d.start_y = d3.event.y+new_d.start_y;
     new_d.control_start_x = d3.event.x+new_d.control_start_x;
     new_d.control_start_y = d3.event.y+new_d.control_start_y;
     new_d.control_end_x = d3.event.x+new_d.control_end_x;
     new_d.control_end_y = d3.event.y+new_d.control_end_y;
     new_d.end_x = d3.event.x+new_d.end_x;
     new_d.end_y = d3.event.y+new_d.end_y;
   } else {
     new_d.start_x = d3.event.x+new_d.start_x;
     new_d.start_y = d3.event.y+new_d.start_y;
    }
   bezier.datum(new_d);

   set_bezier_curve(bezier);
   bezier.attr("transform", "translate(" + new_d.start_x + "," + new_d.start_y+")");

	 recalculate();
}

function dragged_beziercontrolstart(d) {
   bezier = d3.select(this.parentNode);
    if (CURRENT_SELECTION != null) { CURRENT_SELECTION.attr("style","outline: none;"); }
   CURRENT_SELECTION = bezier;
   CURRENT_SELECTION.attr("style","outline: 1px dashed lightgray; outline-offset: 3px;")
   new_d = bezier.datum();
   new_d.control_start_x = d3.event.x+new_d.start_x; // Events are given relative to the parent node, which in this case is already translated
   new_d.control_start_y = d3.event.y+new_d.start_y;
   bezier.datum(new_d);

   set_bezier_curve(bezier);

	 recalculate();
}

function dragged_beziercontrolend(d) {
   bezier = d3.select(this.parentNode);
    if (CURRENT_SELECTION != null) { CURRENT_SELECTION.attr("style","outline: none;"); }
   CURRENT_SELECTION = bezier;
   CURRENT_SELECTION.attr("style","outline: 1px dashed lightgray; outline-offset: 3px;")
   new_d = bezier.datum();
   new_d.control_end_x = d3.event.x+new_d.start_x; // Events are given relative to the parent node, which in this case is already translated
   new_d.control_end_y = d3.event.y+new_d.start_y;
   bezier.datum(new_d);

   set_bezier_curve(bezier);

	 recalculate();
}

function dragged_bezierend(d) {
   bezier = d3.select(this.parentNode);
   if (CURRENT_SELECTION != null) { CURRENT_SELECTION.attr("style","outline: none;"); }
   CURRENT_SELECTION = bezier;
   CURRENT_SELECTION.attr("style","outline: 1px dashed lightgray; outline-offset: 3px;")
   new_d = bezier.datum();
   new_d.end_x = d3.event.x+new_d.start_x; // Events are given relative to the parent node, which in this case is already translated
   new_d.end_y = d3.event.y+new_d.start_y;
   bezier.datum(new_d);

   set_bezier_curve(bezier);

	 recalculate();
}

function dragged_camera(d) {
  delta_x = focal_x-camera_x;
  delta_y = focal_y-camera_y;

  if (d3.select("#lockorigin_checkbox").property("checked")) {

    var focal_value = Math.sqrt(delta_x*delta_x+delta_y*delta_y);

  	camera_x = d3.event.x;
  	camera_y = d3.event.y;
  	camera_eye
  		.attr("cx",camera_x)
  		.attr("cy",camera_y);

  	var cam_distance = Math.sqrt((camera_x-cam_focus_x)*(camera_x-cam_focus_x)+(camera_y-cam_focus_y)*(camera_y-cam_focus_y));
  	var angle = Math.atan2(camera_y-cam_focus_y, camera_x-cam_focus_x);

  	focal_x  = cam_focus_x+(cam_distance+focal_value)*Math.cos(angle);
  	focal_y  = cam_focus_y+(cam_distance+focal_value)*Math.sin(angle);
  	camera_focal
  		.attr("cx",focal_x)
  		.attr("cy",focal_y);

  	camera_line
  		.attr("x1",camera_x)
  		.attr("x2",focal_x)
  		.attr("y1",camera_y)
  		.attr("y2",focal_y);

    camera_focusline
  	.attr("x1",camera_x)
  	.attr("x2",cam_focus_x)
  	.attr("y1",camera_y)
  	.attr("y2",cam_focus_y);
  	recalculate();
  } else {
	camera_x = d3.event.x;
	camera_y = d3.event.y;
	focal_x = camera_x+delta_x;
	focal_y = camera_y+delta_y;

	camera_eye
		.attr("cx",camera_x)
		.attr("cy",camera_y);
	camera_focal
		.attr("cx",focal_x)
		.attr("cy",focal_y);
	camera_line
		.attr("x1",camera_x)
		.attr("x2",focal_x)
		.attr("y1",camera_y)
		.attr("y2",focal_y);
	recalculate();
  }
}
function dragged_focal(d) {
  if (d3.select("#lockorigin_checkbox").property("checked")) {
	return;
  }

  focal_x = d3.event.x;
  focal_y = d3.event.y;

  camera_focal
    .attr("cx",focal_x)
	.attr("cy",focal_y);
  camera_line
	.attr("x1",camera_x)
	.attr("x2",focal_x)
	.attr("y1",camera_y)
	.attr("y2",focal_y);

 recalculate();
}
function dragged_cam_focus(d) {
  cam_focus_x = d3.event.x;
  cam_focus_y = d3.event.y;

  camera_focus
  .attr("cx",cam_focus_x)
	.attr("cy",cam_focus_y);
  camera_focusline
	.attr("x1",camera_x)
	.attr("x2",cam_focus_x)
	.attr("y1",camera_y)
	.attr("y2",cam_focus_y);

 recalculate();
}

function toggle_lock() {
  if (d3.select("#lockorigin_checkbox").property("checked")) {
    d3.select("#camera_focus").attr("visibility","visible");
    d3.select("#camera_focusline").attr("visibility","visible");
  } else {
    d3.select("#camera_focus").attr("visibility","hidden");
    d3.select("#camera_focusline").attr("visibility","hidden");

  }
}

function get_circleprojection(xc,yc,focal,angle,x,y,r) {
    var nx = x-xc;
    var ny = y-yc;

		var nnx = -(nx*Math.cos(angle)+ny*Math.sin(angle));
    var nny = -nx*Math.sin(angle)+ny*Math.cos(angle);

		var thenorm = Math.sqrt(nnx*nnx+(nny+focal)*(nny+focal));

		var alpha = Math.atan(nnx/(nny+focal));
		var theta = Math.asin(r/thenorm);

    var p1_x = nnx-r*Math.cos(alpha-theta);
    var p1_y = nny+r*Math.sin(alpha-theta);
    var p2_x = nnx+r*Math.cos(alpha+theta);
    var p2_y = nny-r*Math.sin(alpha+theta);

		var proj1 = p1_x/(1.0+p1_y/focal);
		var proj2 = p2_x/(1.0+p2_y/focal);

		return [Math.min(proj1,proj2),Math.max(proj1,proj2)]
}

function get_pointprojection(xc,yc,focal,angle,x,y) {
		var nx = x-xc;
		var ny = y-yc;

		var nnx = -(nx*Math.cos(angle)+ny*Math.sin(angle));
		var nny = -nx*Math.sin(angle)+ny*Math.cos(angle);

		return nnx/(1.0+nny/focal);
}

function recalculate() {
  var focal_value = Math.sqrt((focal_x-camera_x)*(focal_x-camera_x)+(focal_y-camera_y)*(focal_y-camera_y));
  var angle = Math.atan2((camera_y-focal_y), (camera_x-focal_x))-Math.PI/2;
  if (d3.select("#isometric_checkbox").property("checked")) {
	focal_value = 100000;
  }

  graphix_proj.selectAll(".score_projection").remove();
  graphix_proj.append("line").attr("class","score_projection").attr("x1",-10000).attr("x2",10000).attr("y1",0).attr("y2",0).attr("stroke","lightgray");
  var step = 5/CM_TO_SEC;
  var MAXSEC = 300;
  for (i=-MAXSEC/CM_TO_SEC;i<=MAXSEC/CM_TO_SEC;i+=step) {
      graphix_proj.append("line").attr("class","score_projection")
                  .attr("x1",i).attr("x2",i).attr("y1",-100).attr("y2",500)
                  .attr("stroke","lightgray")
                  .attr("stroke-width",0.1);
  }
  var step = 10/CM_TO_SEC;
  for (i=-MAXSEC/CM_TO_SEC;i<=MAXSEC/CM_TO_SEC;i+=step) {
      graphix_proj.append("line").attr("class","score_projection")
                  .attr("x1",i).attr("x2",i).attr("y1",-100).attr("y2",500)
                  .attr("stroke","lightgray")
                  .attr("stroke-width",0.5);
  }
  var step = 60/CM_TO_SEC;
  for (i=-MAXSEC/CM_TO_SEC;i<=MAXSEC/CM_TO_SEC;i+=step) {
      graphix_proj.append("line").attr("class","score_projection")
                  .attr("x1",i).attr("x2",i).attr("y1",-100).attr("y2",500)
                  .attr("stroke","lightgray")
                  .attr("stroke-width",1);
  }
  graphix_proj.append("line").attr("class","score_projection").attr("x1",0).attr("x2",0).attr("y1",-5).attr("y2",5).attr("stroke","black");


  d3.selectAll(".elements-circle")
		.each(function(d) {
				ah = get_circleprojection(camera_x,camera_y,focal_value,angle,d.center_x,d.center_y,d.r);
				graphix_proj.append("rect")
                .attr("class","score_projection")
							  .attr("x",ah[0])
							  .attr("y",d.sound_index*10)
							  .attr("width",ah[1]-ah[0])
							  .attr("height",10)
							  .attr("fill","rgb("+SOUNDS_LIST[d.sound_index].color[0]+","+SOUNDS_LIST[d.sound_index].color[1]+","+SOUNDS_LIST[d.sound_index].color[2]+")")
							  .attr("opacity",0.4);
			  });
	d3.selectAll(".elements-point")
		.each(function(d) {
				var x_proj = get_pointprojection(camera_x,camera_y,focal_value,angle,d.x,d.y);
				graphix_proj.append("circle")
                .attr("class","score_projection")
							  .attr("cx",x_proj)
							  .attr("cy",d.sound_index*10+5)
							  .attr("r",2)
							  .attr("fill","rgb("+SOUNDS_LIST[d.sound_index].color[0]+","+SOUNDS_LIST[d.sound_index].color[1]+","+SOUNDS_LIST[d.sound_index].color[2]+")")
							  .attr("opacity",0.4);
			  });
  d3.selectAll(".elements-bezier")
		.each(function(d) {
			  points_x = d.points_x;
        points_y = d.points_y;
        for (i=0;i<points_x.length;i++) {
  				var x_proj = get_pointprojection(camera_x,camera_y,focal_value,angle,points_x[i],points_y[i]);
  				graphix_proj.append("circle")
                  .attr("class","score_projection")
  							  .attr("cx",x_proj)
  							  .attr("cy",d.sound_index*10+5)
  							  .attr("r",2)
  							  .attr("fill","rgb("+SOUNDS_LIST[d.sound_index].color[0]+","+SOUNDS_LIST[d.sound_index].color[1]+","+SOUNDS_LIST[d.sound_index].color[2]+")")
  							  .attr("opacity",0.4);

        }
      });
}
