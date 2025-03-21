const config = require('./config');
const os = require('os');

const requests = {};
const activeUsers = new Set();

function requestTracker(req, res, next) {
    const endpoint = req.path;
    const method = req.method;
    activeUsers.add(req.user);

    if (!requests[endpoint]) {
        requests[endpoint] = {};
    }

    requests[endpoint][method] = (requests[endpoint][method] || 0) + 1;
    next();
}

let successes = 0;
let failures = 0;

function authTracker(success) {
    if (success) {
        successes++;
    }
    else {
        failures++;
    }
}


function getCpuUsagePercentage() {
  const cpuUsage = (os.loadavg()[0] / os.cpus().length) * 100;
//   console.log(`CPU: ${cpuUsage.toFixed(2)}`);
  return Math.round(cpuUsage);
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return Math.round(memoryUsage);
}

setInterval(() => {
    Object.keys(requests).forEach((endpoint) => {
        Object.keys(requests[endpoint]).forEach((method) => {
    
          sendHTTPMetricToGrafana('http_requests', requests[endpoint][method], {
            method: method, 
            endpoint: endpoint 
          });
        });
      });

    Object.keys(requests).forEach((endpoint) => {
        requests[endpoint] = 0;
    });

    sendMetricToGrafana('cpu_usage', getCpuUsagePercentage(), 'gauge', 'percent');
    sendMetricToGrafana('memory_usage', getMemoryUsagePercentage(), 'gauge', 'percent');
    sendMetricToGrafana('active_users', activeUsers.size, 'gauge', 'count');

    activeUsers.clear();
}, 10000);


// function sendMetricsPeriodically(period) {
//     const timer = setInterval(() => {
//       try {
//         const buf = new MetricBuilder();
//         httpMetrics(buf);
//         systemMetrics(buf);
//         userMetrics(buf);
//         purchaseMetrics(buf);
//         authMetrics(buf);
  
//         const metrics = buf.toString('\n');
//         this.sendMetricToGrafana(metrics);
//       } catch (error) {
//         console.log('Error sending metrics', error);
//       }
//     }, period);
//   }

function sendMetricToGrafana(metricName, metricValue, type, unit) {
    const metric = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: metricName,
                  unit: unit,
                  [type]: {
                    dataPoints: [
                      {
                        asInt: metricValue,
                        timeUnixNano: Date.now() * 1000000,
                        attributes: [
                            {
                                key: "source",
                                value: { stringValue: config.metrics.source }
                            }
                        ],

                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  
    if (type === 'sum') {
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
    }
  
    const body = JSON.stringify(metric);
    fetch(`${config.metrics.url}`, {
      method: 'POST',
      body: body,
      headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
    })
      .then((response) => {
        if (!response.ok) {
          response.text().then((text) => {
            console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
          });
        } else {
          console.log(`Pushed ${metricName}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }


  function sendHTTPMetricToGrafana(metricName, metricValue, attributes) {
    attributes = { ...attributes, source: config.metrics.source };
  
    const metric = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: metricName,
                  unit: '1',
                  sum: {
                    dataPoints: [
                      {
                        asInt: metricValue,
                        timeUnixNano: Date.now() * 1000000,
                        attributes: [],
                      },
                    ],
                    aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                    isMonotonic: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  
    Object.keys(attributes).forEach((key) => {
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push({
        key: key,
        value: { stringValue: attributes[key] },
      });
    });
  
    fetch(`${config.metrics.url}`, {
      method: 'POST',
      body: JSON.stringify(metric),
      headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        } else {
          console.log(`Pushed ${metricName}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
  
  module.exports = { requestTracker, authTracker };