const path = require('path');
const fs = require('fs')
const express = require('express');
const OS = require('os');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
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

const planetDataSourceCounter = new client.Counter({
    name: 'planet_data_source_total',
    help: 'Total planet lookups by data source',
    labelNames: ['source'],
    registers: [register]
})

const planetDbLookupErrorsCounter = new client.Counter({
    name: 'planet_db_lookup_errors_total',
    help: 'Total failed DB lookups for planets',
    registers: [register]
})

const planetDbLookupDuration = new client.Histogram({
    name: 'planet_db_lookup_duration_seconds',
    help: 'Duration of planet DB queries in seconds',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [register]
})


app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));
app.use(cors())

app.use((req, res, next) => {
    const traceId = req.headers['x-trace-id'] || crypto.randomBytes(8).toString('hex')
    req.traceId = traceId
    res.setHeader('X-Trace-Id', traceId)
    next()
})

app.use((req, res, next) => {
    activeConnections.inc()
    const start = Date.now()
    const end = httpRequestDuration.startTimer()
    console.debug(`[trace_id=${req.traceId}] request_started method=${req.method} path=${req.path}`)
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000
        end({ method: req.method, route: req.path, status_code: res.statusCode })
        activeConnections.dec()
        if (res.statusCode >= 500) {
            console.error(`[trace_id=${req.traceId}] method=${req.method} path=${req.path} status=${res.statusCode} duration=${duration.toFixed(3)}s`)
        } else if (res.statusCode >= 400) {
            console.warn(`[trace_id=${req.traceId}] method=${req.method} path=${req.path} status=${res.statusCode} duration=${duration.toFixed(3)}s`)
        } else {
            console.log(`[trace_id=${req.traceId}] method=${req.method} path=${req.path} status=${res.statusCode} duration=${duration.toFixed(3)}s`)
        }
        if (duration > 3) {
            console.warn(`[trace_id=${req.traceId}] slow_request method=${req.method} path=${req.path} duration=${duration.toFixed(3)}s`)
        }
    })
    next()
})

let postgresPool = null
const usePostgres = Boolean(process.env.DATABASE_URL) || Boolean(process.env.POSTGRES_HOST)

if (usePostgres) {
    const poolConfig = process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.POSTGRES_HOST,
            port: Number(process.env.POSTGRES_PORT || 5432),
            database: process.env.POSTGRES_DB || 'postgres',
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD
        }

    postgresPool = new Pool(poolConfig)
    postgresPool.connect((err, client, release) => {
        if (err) {
            console.error(`postgres_connection_error error="${err.message}"`)
            return
        }
        console.log('postgres_connected')
        release()
    })
} else {
    console.log('postgres_not_configured running_without_db=true')
}

const planetsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'planets.json'), 'utf8'));

app.post('/planet', async function(req, res) {
    const start = Date.now()
    const traceId = req.traceId
    console.debug(`[trace_id=${traceId}] planet_lookup_start id=${req.body.id}`)
    if (!req.body.id) {
        console.error(`[trace_id=${traceId}] missing_planet_id body=${JSON.stringify(req.body)}`)
        return res.status(400).send({ error: "Missing planet id" });
    }
    const parsedId = parseInt(req.body.id)
    if (isNaN(parsedId) || parsedId < 0) {
        console.error(`[trace_id=${traceId}] invalid_planet_id id=${req.body.id} reason=${isNaN(parsedId) ? 'not_a_number' : 'negative_id'}`)
        return res.status(400).send({ error: "Invalid planet id" });
    }
    const delay = Math.floor(Math.random() * 5000);
    await new Promise(resolve => setTimeout(resolve, delay));

    if (postgresPool) {
        const dbStart = Date.now()
        console.debug(`[trace_id=${traceId}] db_lookup_start id=${parsedId}`)
        try {
            const result = await postgresPool.query(
                'SELECT id, name, description, image, velocity, distance FROM planets WHERE id = $1 LIMIT 1',
                [parsedId]
            )
            const dbDuration = (Date.now() - dbStart) / 1000
            planetDbLookupDuration.observe(dbDuration)
            const planetData = result.rows[0]
            if (planetData) {
                planetDataSourceCounter.inc({ source: 'db' })
                planetRequestsCounter.inc({ planet_name: planetData.name })
                const duration = (Date.now() - start) / 1000
                console.log(`[trace_id=${traceId}] db_lookup_hit id=${parsedId} name=${planetData.name}`)
                console.log(`[trace_id=${traceId}] planet_found id=${parsedId} name=${planetData.name} source=db duration=${duration.toFixed(3)}s`)
                return res.send(planetData);
            } else {
                console.warn(`[trace_id=${traceId}] db_lookup_miss id=${parsedId}`)
            }
        } catch (err) {
            const dbDuration = (Date.now() - dbStart) / 1000
            planetDbLookupDuration.observe(dbDuration)
            planetDbLookupErrorsCounter.inc()
            console.error(`[trace_id=${traceId}] db_lookup_failed id=${parsedId} error="${err.message}"`)
            console.log(`[trace_id=${traceId}] db_fallback id=${parsedId}`)
        }
    }

    const planet = planetsData.find(p => p.id === parsedId);
    const duration = (Date.now() - start) / 1000
    if (planet) {
        planetDataSourceCounter.inc({ source: 'json' })
        planetRequestsCounter.inc({ planet_name: planet.name })
        console.log(`[trace_id=${traceId}] planet_found id=${parsedId} name=${planet.name} source=json duration=${duration.toFixed(3)}s`)
    } else {
        console.warn(`[trace_id=${traceId}] planet_not_found id=${parsedId} source=json duration=${duration.toFixed(3)}s`)
    }
    return res.send(planet);
});


app.get('/',   async (req, res) => {
    console.debug(`[trace_id=${req.traceId}] serving_index client_ip=${req.ip}`)
    res.sendFile(path.join(__dirname, '/', 'index.html'));
});

app.get('/api-docs', (req, res) => {
    console.debug(`[trace_id=${req.traceId}] api_docs_requested`)
    fs.readFile('oas.json', 'utf8', (err, data) => {
      if (err) {
        console.error(`[trace_id=${req.traceId}] api_docs_error error="${err.message}"`);
        res.status(500).send('Error reading file');
      } else {
        console.debug(`[trace_id=${req.traceId}] api_docs_served size=${data.length}bytes`)
        res.json(JSON.parse(data));
      }
    });
  });

app.get('/os',   function(req, res) {
    console.debug(`[trace_id=${req.traceId}] os_info_requested hostname=${OS.hostname()}`)
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
        console.log(`solar_system starting hostname=${OS.hostname()} port=3000`);
        console.debug(`loaded ${planetsData.length} planets from planets.json`)
        console.debug(`environment=${process.env.NODE_ENV || 'development'} mongo_configured=${!!process.env.MONGO_URI}`)
    });
}

module.exports = app;


//module.exports.handler = serverless(app)