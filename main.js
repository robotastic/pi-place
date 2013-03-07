var util = require('util');
var Matrix = require('pi-led').PiLed;
var Espn = require('espn-headlines');
var Npr = require('npr-news');
var wmata = require('node-wmata');


var items = [];
var id = 0;
var len;

var current = 0;

var matrix = new Matrix();

var express = require('express');
var app = express();
var server = require('http').createServer(app);
server.listen(80, '10.0.1.14');

var io = require('socket.io').listen(server);

var News = function() {
	var self = this;
	this.npr = new Npr('NPR API Key Here');
	this.headlines = [];
	this.text = 'Filler';
	this.type = 'news';
	this.creator = 'npr';
	this.headline = 0;
	this.id = -1;
	this.lastUpdate = 0;
	this.getText = function() {
		return this.text;
	}
	this.update = function() {
		var elapsed = Date.now() - this.lastUpdate;
		if(elapsed > 1000000) {


			this.npr.getNews( function(res) {
				if (res && res.list && res.list.story) {
					var stories = res.list.story;
					self.headlines = [];
	
					for (var i =0; i < stories.length; i++ ) {
						self.headlines.push(stories[i].title.$text); // + ": " + stories[i].teaser.$text);
					}
				
					self.headline = 0;
					self.text = self.headlines[self.headline];
					self.lastUpdate = Date.now();
					updateItem(self);
				}
			});

		} else {
			this.headline++;
			if (this.headline == this.headlines.length) 
				this.headline = 0;
			self.text = this.headlines[this.headline];
			updateItem(self);
		}
	}
	this.update();
}

var Sports = function() {
	var self = this;
	this.headlines = [];
	this.text = "Filler";
	this.type = 'sports';
	this.creator = 'espn';
	this.id = -1;
	this.espn = new Espn('ESPN API Key Here');
	this.lastUpdate = 0;
	this.headline = 0;
	this.getText = function() {
		return this.text;
	}
	this.update = function() {
		var elapsed = Date.now() - this.lastUpdate;
		if(elapsed > 1000000) {


			this.espn.getHeadlines('football','nfl', function(res) {
				
				self.headlines = [];
				if (res && res.headlines) {
					for (var i =0; i < res.headlines.length; i++ ) {
						self.headlines.push(res.headlines[i].headline); // + ": " + res.headlines[i].description);
						
					}
				
					self.headline = 0;
					self.text = self.headlines[self.headline];
					self.lastUpdate = Date.now();
					updateItem(self);
					
				}
			});

		} else {
			this.headline++;
			if (this.headline == this.headlines.length) 
				this.headline = 0;
			self.text = this.headlines[this.headline];
			updateItem(self);

		}
	}
	this.update();
}


//1001888
var Bus = function(stop) {
		var wmataWebServiceClient = new wmata.WebServiceClient('wmata API Key Here');
		var self = this;
		this.text = "Filler";
		this.type = 'tansportation';
		this.creator = 'wmata';
		this.id = -1;
		this.lastUpdate = 0;
		this.stop = stop;
		this.getText = function() {
			return this.text;
		}

		this.update = function() {
			var elapsed = Date.now() - this.lastUpdate;
			if(elapsed > 50000) {
				wmataWebServiceClient.busPrediction(stop, function(error, result) {
					if(error) {
						console.log(error);
					}

					if(result) {
						var bus = "";
						for(var i = 0; i < result.Predictions.length; i++) {
							var prediction = result.Predictions[i];
						    if (prediction.Minutes < 45) {
							bus = bus + prediction.RouteID + ": " + prediction.Minutes + " min ";
						    }
						}
						self.text = bus;
						self.lastUpdate = Date.now();
					    updateItem(self);
					    
					}
				});
			}
		}
		this.update();
	};


var Story = function(text, creator) {
		this.text = text;
		this.id = -1;
		this.type = 'story';
		this.creator = creator;
		this.update = function() {}
		this.getText = function() {
			return this.text;
		}
	};


var Message = function(text) {
		this.text = text;
		this.id = -1;
		this.type = 'message';
		this.update = function() {}
		this.getText = function() {
			return this.text;
		}
	};


function buildItem(item, i) {
	var temp= {};
		temp.id = item.id;
		temp.text = item.text;
		temp.index = i;
		if (item instanceof Message)
			temp.remove = true;
		else
			temp.remove = false;
	return temp;
}
function buildList() {
	var list = [];
	for (var i=0; i < items.length; i++) {
		list.push(buildItem(items[i],i));
	}
	return list;
}

function addItem(item) {
	item.id = id++;
	items.push(item);
	len = items.length;
}



function addMessage(message) {
	addItem(new Message(message));

	io.sockets.emit('add', { item: buildItem(items[len-1], len-1) });
}

function updateItem(item) {
	var id,i;
	for (var i=0; i < len; i++) {
		if (items[i].id == item.id) {
			items[i] = item;
			id = item.id;
			break;
		}
	}
	io.sockets.emit('update', { item: buildItem(item, item.index) });
}

function removeItem(id) {
for (var i=0; i<len; i++)
{
	if (items[i].id == id){
		items.splice(i,1);
		break;
	}
}
len = items.length;
if (current == len) current = 0;
io.sockets.emit('remove', { id: id });
}

addItem(new Message("Test Message"));
addItem(new Bus(1001888));
addItem(new News());
addItem(new Sports());




server.listen(80);

app.configure(function(){
  app.use(express.bodyParser());
  app.use(app.router);
});

app.use(express.static(__dirname + '/public'));



app.post('/add', function(req, res) {
  addMessage(req.body.message);
  res.contentType('json');
  res.send({ status: 'SUCCESS' });
});

app.get('/remove/:num([0-9]+)/?', function(req, res) {
	var num = req.params.num;
  console.log("Removing Item: " + num);
  removeItem(num);
  res.contentType('json');
  res.send({ status: 'SUCCESS' });
});

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.use(function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

matrix.WriteMessage(items[current].getText(), function(err, result) {
		
});

matrix.on('FinishedWrite', function(s) {
    

    var text = items[current].getText();
    io.sockets.emit('current', {id: items[current].id });
    if (!text) text="Filler";
    matrix.WriteMessage(text, function(err, result) {
	
    });
    current++;
    if (current == len) {
  	current = 0;
  	
    } 
    items[current].update();
});





io.sockets.on('connection', function (socket) {

  socket.emit('items', { items: buildList() });
  socket.on('my other event', function (data) {
   
  });
});

