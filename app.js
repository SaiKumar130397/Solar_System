const path = require('path');
const fs = require('fs')
const express = require('express');
const OS = require('os');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const app = express();
const cors = require('cors')
const serverless = require('serverless-http')
const client = require('prom-client')

const register = new client.Registry()
client.collectDefaultMetrics({ register })

const planetRequestsCounter = new client.Counter({
    name: 'planet_requests_total',
    help: 'Total number of requests to the /planet endpoint',
    labelNames: ['planet_name'],
    registers: [register]
})

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register]
})

const activeConnections = new client.Gauge({
    name: 'active_connections',
    help: 'Number of active connections being handled',
    registers: [register]
})


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));
app.use(cors())

app.use((req, res, next) => {
    activeConnections.inc()
    const end = httpRequestDuration.startTimer()
    res.on('finish', () => {
        end({ method: req.method, route: req.path, status_code: res.statusCode })
        activeConnections.dec()
    })
    next()
})

if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI, {
        user: process.env.MONGO_USERNAME,
        pass: process.env.MONGO_PASSWORD,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }, function(err) {
        if (err) {
            console.log("Mongo connection error: " + err)
        } else {
            console.log("MongoDB Connected")
        }
    });
} else {
    console.log("Mongo not configured. Running without DB.");
}

var Schema = mongoose.Schema;

var dataSchema = new Schema({
    name: String,
    id: Number,
    description: String,
    image: String,
    velocity: String,
    distance: String
});
var planetModel = mongoose.model('planets', dataSchema);



app.post('/planet', function(req, res) {

    if (!process.env.MONGO_URI) {
        const mockPlanets = {
            1: { id: 1, name: "Mercury" },
            2: { id: 2, name: "Venus" },
            3: { id: 3, name: "Earth" },
            4: { id: 4, name: "Mars" },
            5: { id: 5, name: "Jupiter" },
            6: { id: 6, name: "Saturn" },
            7: { id: 7, name: "Uranus" },
            8: { id: 8, name: "Neptune" }
        };

        const planet = mockPlanets[req.body.id]
        if (planet) planetRequestsCounter.inc({ planet_name: planet.name })
        return res.send(planet);
    }

    planetModel.findOne({ id: req.body.id }, function(err, planetData) {
        if (err) {
            res.send("Error in Planet Data");
        } else {
            if (planetData) planetRequestsCounter.inc({ planet_name: planetData.name })
            res.send(planetData);
        }
    });
});


app.get('/',   async (req, res) => {
    res.sendFile(path.join(__dirname, '/', 'index.html'));
});

app.get('/api-docs', (req, res) => {
    fs.readFile('oas.json', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        res.status(500).send('Error reading file');
      } else {
        res.json(JSON.parse(data));
      }
    });
  });
  
app.get('/os',   function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send({
        "os": OS.hostname(),
        "env": process.env.NODE_ENV
    });
})

app.get('/live',   function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send({
        "status": "live"
    });
})

app.get('/ready',   function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send({
        "status": "ready"
    });
})

app.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', register.contentType)
    res.send(await register.metrics())
})

if (require.main === module) {
    app.listen(3000, () => {
        console.log("Server successfully running on port - 3000");
    });
}

module.exports = app;


//module.exports.handler = serverless(app)