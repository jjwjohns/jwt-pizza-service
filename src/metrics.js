const config = require('./config');
const os = require('os');

const requests = {};

function requestTracker(req, res, next) {
    const endpoint = req.path;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    // console.log(`Tracked: ${endpoint}, Count: ${requests[endpoint]}`);
    next();
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
//   console.log(`CPU: ${cpuUsage}`);
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
//   console.log(`Memory: ${memoryUsage}`);
  return memoryUsage.toFixed(2);
}


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


// This will periodically send metrics to Grafana
setInterval(() => {
  Object.keys(requests).forEach((endpoint) => {
    // console.log(`Sending ${requests[endpoint]} requests for ${endpoint}`);
    sendMetricToGrafana('requests', requests[endpoint], 'sum' , '1');
    sendMetricToGrafana('cpu_usage', getCpuUsagePercentage(), 'gauge', 'percent');
    sendMetricToGrafana('memory_usage', getMemoryUsagePercentage(), 'gauge', 'percent');
  });
}, 10000);

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
                        value: Number.isInteger(metricValue)
                        ? { asInt: metricValue }
                        : { doubleValue: metricValue },
                        timeUnixNano: Date.now() * 1000000,
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

module.exports = { requestTracker };