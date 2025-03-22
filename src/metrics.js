const config = require('./config');
const os = require('os');

const requests = {};
const activeUsers = new Set();

let sold = 0;
let failure = 0;
let revenue = 0;
let latencies = [];
let Orderlatencies = [];

function requestTracker(req, res, next) {
  if (!(req.path === '/api/order' && req.method === 'POST')) {
    const start = process.hrtime();
    res.on("finish", () => {
      const diff = process.hrtime(start);
      const latencyMs = (diff[0] * 1e3) + (diff[1] / 1e6);
      latencies.push(latencyMs);
    });
  }

  const endpoint = req.path;
  const method = req.method;
  if (req.user) {
      activeUsers.add(req.user);
  }

  if (!requests[endpoint]) {
      requests[endpoint] = {};
  }

  requests[endpoint][method] = (requests[endpoint][method] || 0) + 1;

  if (req.path === '/api/order' && req.method === 'POST') {
    const startOrder = process.hrtime();
    res.on('finish', () => {
      const Orderdiff = process.hrtime(startOrder);
      const OrderlatencyMs = (Orderdiff[0] * 1e3) + (Orderdiff[1] / 1e6);
      Orderlatencies.push(OrderlatencyMs);

      if (res.statusCode === 200) {
          req.body.items.forEach(item => {
              sold++;
              revenue += item.price;
          });
        } 
      if (res.statusCode >= 500) {
        console.log('Failure:', res.statusCode);
        failure++;
      }
    });
  }
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
    sendMetricToGrafana('auth_successes', successes, 'sum', 'count');
    sendMetricToGrafana('auth_failures', failures, 'sum', 'count');
    successes = 0;
    failures = 0;
    sendMetricToGrafana('pizzas_sold', sold, 'sum', 'count');
    sendMetricToGrafana('orders_failed', failure, 'sum', 'count');
    sendMetricToGrafana('revenue', revenue, 'sum', 'BTC');
    sold = 0;
    failure = 0;
    revenue = 0;
    if (latencies.length > 0) {
      sendMetricToGrafana('latency', latencies.reduce((sum, num) => sum + num, 0) / latencies.length, 'gauge', 'ms');
      latencies = [];
    }
    if (Orderlatencies.length > 0){
      sendMetricToGrafana('order_latency', Orderlatencies.reduce((sum, num) => sum + num, 0) / Orderlatencies.length, 'gauge', 'ms');
      Orderlatencies = [];
    }
}, 10000);

setInterval(() => {
    sendMetricToGrafana('active_users', activeUsers.size, 'gauge', 'count')
    activeUsers.clear();
}, 30000);

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
                        ...(unit === "BTC" || unit === "ms" ? { asDouble: metricValue } : { asInt: metricValue }),
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
  
  // copilot generate code for testing
  const metrics = {
    getRequestCount: () => {
        return Object.values(requests).reduce((acc, methods) => {
            return acc + Object.values(methods).reduce((sum, count) => sum + count, 0);
        }, 0);
    },
    getFailedRequestCount: () => failure,
    getActiveUsers: () => Array.from(activeUsers),
    getAuthSuccessCount: () => successes,
    getAuthFailureCount: () => failures,
    reset: () => {
        Object.keys(requests).forEach(endpoint => {
            Object.keys(requests[endpoint]).forEach(method => {
                requests[endpoint][method] = 0;
            });
        });
        activeUsers.clear();
        sold = 0;
        failure = 0;
        revenue = 0;
        successes = 0;
        failures = 0;
    }
};

  module.exports = { requestTracker, authTracker, metrics };