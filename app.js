const path = require('path');
const fs = require('fs')
const express = require('express');
const OS = require('os');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const app = express();
const cors = require('cors')
const serverless = require('serverless-http')


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));
app.use(cors())

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

        return res.send(mockPlanets[req.body.id]);
    }

    planetModel.findOne({ id: req.body.id }, function(err, planetData) {
        if (err) {
            res.send("Error in Planet Data");
        } else {
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

if (require.main === module) {
    app.listen(3000, () => {
        console.log("Server successfully running on port - 3000");
    });
}

module.exports = app;


//module.exports.handler = serverless(app)