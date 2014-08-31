
//poisson-disk.js | Jeffrey Hearn | https://github.com/jeffrey-hearn/poisson-disk-sample
//perlin.js | https://github.com/josephg/noisejs
//astaar.js | https://github.com/bgrins/javascript-astar

//Levels, height levels for borders between "tile types"
var SEALEVEL = 0;
var BEACHLEVEL = 0.05;
var PLAINSLEVEL = 0.15;
var MOUNTAINLEVEL = 0.45;
var SNOWLEVEL = 0.6;
var DEEPSEA = -0.1;
//Biomelimits
var POLARLIMIT = 0.5;
var DESERTLIMIT = 0.1;
//Not needed
var CITYAMOUNT = 9;
//Size of map in pixels
var SIZEX = 1024;
var SIZEY = 512+256;
//Minimum distance between cell centers
var CELLMINDISTANCE = 4;
//Dont change, not everything uses this
var SCALE = 1;

var SHADOWLIMIT = 0.01;

//Divisors used by height();
var perldivisors = [2, 4, 8, 16, 32, 64, 128];

noise.seed(Math.random());
var i, j;
//colors of the map
var colors = ["#006994", "#fee8d6", "#5b5", "#171", "#aaa", "#bbb", "#0ea1aa"];
var polarcolors = ["#d4f0ff", "#e0ffff", "#eee9e9", "#eeeaea", "#aaa", "#f00", "#e0ffff"];
var desertcolors = ["#006994", "#fee8d6", "#fee8d6", "#eed8c6", "#aaa", "#bbb", "#0ea1aa"];
var biomes = [colors,polarcolors,desertcolors];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function rgba(r, g, b, a) {
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

//This function calculates shadow for each point. With low density map they don't look that good.
function getShadow(x, y, cur) {
    //Get height for asked point
    
    //Get height for comparison point used to calculate slope
    var compare = height(x - CELLMINDISTANCE, y - CELLMINDISTANCE);
    //var slope = (cur - up) - (cur - left);
    var slope = compare - cur;
    //Return value, Light side or shadowside, 0 for flat land
    if (slope < SHADOWLIMIT && slope > -SHADOWLIMIT) return 0;
    if (slope >= SHADOWLIMIT) return slope; //"alpha"
    if (slope <= -SHADOWLIMIT) return slope;
}
//Extension to grid. get closest point in grid based on point p
Grid.prototype.getClosestPoint = function (p) {
    var cellsAround = this.cellsAroundPoint(p);
    var d = 9999999,
        newd, closest, cur;

    for (var i = 0; i < cellsAround.length; i++) {
        cur = cellsAround[i];
        if (cur !== null) {
            newd = this.calcDistance(cur, p);
            if (newd < d) {
                d = newd;
                closest = cur;
            }
        }
    }
    if (closest) return closest;
};

//HEIGHMAP GENERATION
function height(x, y) {
    //Get rough map shape with perlin noise, -1 to 1
    var rough = noise.simplex2(x / 256, y / 256) / perldivisors[0]
        + noise.simplex2(x / 128, y / 128) / perldivisors[1] 
        + noise.simplex2(x / 64, y / 64) / perldivisors[2] 
        + noise.simplex2(x / 32, y / 32) / perldivisors[3];
    var detail = noise.simplex2(x / 16, y / 16) / perldivisors[4] 
        + noise.simplex2(x / 8, y / 8) / perldivisors[5] 
        + noise.simplex2(x / 4, y / 4) / perldivisors[6];
    //"Detail" is applied more to high places, making mountains rougher
    var n = rough + detail * (rough + 0.5);
    //Dist is distance from center, if you turned the map a square
    var dist = Math.sqrt(Math.pow(x - SIZEX / 2, 2) + Math.pow((y - SIZEY / 2) * (SIZEX / SIZEY), 2));
    //Height is lower towards edges.
    n -= Math.max(0, Math.pow(dist / (SIZEX / 2), 2) - 0.4);
	if(n > 0.3) n = 0.3 + (n-0.3)*2;
    return n;
}
//BIOMEGENERATION
function biome(x, y, h){
    h = h | 0;
    var distEq = Math.abs(y - SIZEY / 2) / (SIZEY / 2);
    distEq = distEq 
        + noise.simplex2(x / 64, x / 64) / 32 
        + noise.simplex2(x / 32, x / 32) / 64 
        + h / 16;
    if (distEq > POLARLIMIT) {
        return 1;
    }
    if (distEq < DESERTLIMIT) {
        return 2;
    }
    return 0;
}


//START ACTUAL GENERATION
//PoissonDiskSampler gives us a set of quite evenly spaced points.
var sampler = new PoissonDiskSampler(SIZEX, SIZEY, CELLMINDISTANCE, 30);
var points = sampler.sampleUntilSolution();
var grid = sampler.grid;

//Delaunay creates triangles between points, giving us neighbors of cells
//delPoints for delaunay.js
var delPoints = [];
//Loop through points
for (i = 0; i < points.length; i++) {
    p = points[i]; //Dost thou iven hoist.
    //attach height data to each point
    p.height = height(p.x, p.y);
    p.biome = biome(p.x, p.y, p.height);
	p.neighbors = {};
    //Put our points to array for delaunay triangles
    delPoints[i] = [p.x,p.y];
}
//Calculate triangles
var delaunay = Delaunay.triangulate(delPoints);
function calcNeighbors(points, delaunay){
	//Go through the triplets.
	for(var i = 0; i < delaunay.length; i += 3){
		for(var j = 0; j < 3; j++){
			points[delaunay[i+j]].neighbors[delaunay[i+(j+1)%3]] = points[delaunay[i+(j+1)%3]];
			points[delaunay[i+j]].neighbors[delaunay[i+(j+2)%3]] = points[delaunay[i+(j+2)%3]];
		}
	}
}
function getPoint(list, condition){
	do {
		var p = getRandomInt(0,list.length-1);
	} while (!condition(list[p]));
	return p;
}
calcNeighbors(points,delaunay);
var pgraph = new Graph(points, {cost:function(n){return n > 0 ? 1 : 0}});
var start = getPoint(points, function(n){return n.height > 0});
var end = getPoint(points, function(n){return n.height > 0});
var POINTS_HILITE = [start,end];
start = pgraph.grid[start];
end = pgraph.grid[end];

var result = astar.search(pgraph,start,end);
//Voronoi cells, Calculate borders of each cell
var voronoi = new Voronoi();
var bbox = {
    xl: 0,
    yt: 0,
    xr: SIZEX+1,
    yb: SIZEY+1
};
var diagram = voronoi.compute(points, bbox);

//DRAWING PART

//setup canvas
var canvas = document.getElementById('output0');
canvas.width = SIZEX * SCALE;
canvas.height = SIZEY * SCALE;
var context = canvas.getContext('2d');

var p; //point/cell
var curcolor = colors;
function cellToPath(context, cell){
	//Start path (borders of cell)
	try{
		context.beginPath();
		var point = cell.halfedges[0].getStartpoint();
		context.moveTo(point.x, point.y);
		for(j = 0; j < cell.halfedges.length; j++){
			point = cell.halfedges[j].getEndpoint();
			context.lineTo(point.x,point.y);
		}
	} catch(e) {
		return false;
	}
	return true;
}
//Draw as polygons!
//Loop through each cell
for(i = 0; i < diagram.cells.length; i++){
    
    var cell = diagram.cells[i]; //Get cell
    var p = cell.site;//Get point
    
    n = p.height;//Get height
    curcolor = biomes[p.biome];
    //Get color based on height
    context.fillStyle = curcolor[6];
    if (n > SEALEVEL) context.fillStyle = curcolor[1];
    if (n > BEACHLEVEL) context.fillStyle = curcolor[2];
    if (n > PLAINSLEVEL) context.fillStyle = curcolor[3];
    if (n > MOUNTAINLEVEL) context.fillStyle = curcolor[4];
    if (n > SNOWLEVEL) context.fillStyle = curcolor[5];
    if (n < DEEPSEA) context.fillStyle = curcolor[0];
    
    context.strokeStyle = context.fillStyle;
    if (cellToPath(context, cell)){    
		context.fill();
		context.stroke();
	}
    //Calculate shadow and height light
    if(true){
        if(n > 0)
            context.fillStyle = rgba(255,255,255,n*0.7);
        else
            context.fillStyle = rgba(0,0,0,-n*0.2);
        context.fill();
        context.strokeStyle = context.fillStyle;
        context.stroke();
        
        if(n > 0){
            var shade = getShadow(p.x, p.y, p.height);
            
            if (shade > 0) {
                context.fillStyle = rgba(0, 0, 90, shade*2);
                context.fill();
                context.strokeStyle = context.fillStyle;
                context.stroke();
            }
            if (shade < 0) {
                context.fillStyle = rgba(220, 220, 100, -shade);
                context.fill();
                context.strokeStyle = context.fillStyle;
                context.stroke();
            }
        }
    }
    
}
//Draw points
var SHOW_POINTS = false;
if(SHOW_POINTS){
    context.fillStyle = rgba(0,0,0,0.5);
    var p;
    for (i = 0; i < points.length; i++) {
        p = points[i];
        context.fillRect(p.x*SCALE, p.y*SCALE, 2, 2);
    }
}

if(POINTS_HILITE){
	//Draw example of neighbors
	
	context.fillStyle = "#f00";
	context.strokeStyle = "#000";


	context.fillStyle = "#ff0";
	for(neighbor in POINTS_HILITE){
		if(POINTS_HILITE.hasOwnProperty(neighbor)){
			var bcell = diagram.cells[POINTS_HILITE[neighbor].voronoiId];
			cellToPath(context, bcell);
			context.fill();
			context.stroke();
		}
	}
}
//Draw a grid

Grid.prototype.drawGrid = function( canvas ){

	canvas.lineWidth = 0.1;
	canvas.strokeStyle = 'black';

	// Borders
	canvas.beginPath();
	canvas.moveTo( 0, 0 );
	canvas.lineTo( this.width, 0 );
	canvas.lineTo( this.width, this.height );
	canvas.lineTo( 0, this.height );
	canvas.lineTo( 0, 0 );
	canvas.stroke();

	// Vertical lines
	for ( var x = 1; x < this.cellsWide; x++ ){
		canvas.beginPath();
		canvas.moveTo( x * this.cellSize, 0 );
		canvas.lineTo( x * this.cellSize, this.height );
		canvas.stroke();
	}

	// Horizontal lines
	for ( var y = 1; y < this.cellsHigh; y++ ){
		canvas.beginPath();
		canvas.moveTo( 0, y * this.cellSize );
		canvas.lineTo( this.width, y * this.cellSize );
		canvas.stroke();
	}
};

var SHOW_DELAUNAY = false;
if(SHOW_DELAUNAY){
    canvas.lineWidth = 0.2;
    context.strokeStyle = rgba(255,0,0,0.2);
    //grid.drawGrid(context);
    for(i = 0; i < delaunay.length; i++){
        
        var a,b,c;
        a = delPoints[delaunay[i*3 + 0]];
        b = delPoints[delaunay[i*3 + 1]];
        c = delPoints[delaunay[i*3 + 2]];
        context.beginPath();
        context.moveTo( a[0], a[1] );
        context.lineTo( b[0], b[1] );
        context.lineTo( c[0], c[1] );
        context.lineTo( a[0], a[1] );
        context.stroke();
    }
}

var SHOW_ASTAREXAMPLE = true;
if(SHOW_ASTAREXAMPLE && result.length){
	context.strokeStyle = "#000";
	context.moveTo(result[0].x,result[0].y);
	for(i = 0; i < result.length; i++){
		context.lineTo(result[i].x,result[i].y);
	}
	context.stroke();
}










//eof