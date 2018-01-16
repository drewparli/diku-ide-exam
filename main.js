d3.select(window).on('load', main);

// Here, we use d3.queue becasue we want to load the data concurrently. However,
// we need to be sure that both data files are done loading before calling
// the visualization function since d3.json is a async call.
// See https://github.com/d3/d3-queue for more details.
function main(handsJSON) {
  var particles_daily;
  var particles_EU;

  d3.queue()
    .defer(d3.json, "./data/data-hourly.json")  // police districts
    .defer(d3.json, "./data/data-daily.json")
    .defer(d3.json, "./data/date-index.json")
    // .await(function(errMsg, data1) {
    .await(function(errMsg, hourly, daily, index) {
      if (errMsg) {
        console.log("ERROR: " + errMsg)
      } else {
        particles_daily = daily;
        particles_EU = hourly.parts;
        console.log(hourly);
        console.log(daily);
        console.log(particles_EU);
        visualize(hourly, daily, particles_EU, index) // Visualize emission graph
        // visualize(hourly, index)               // Visualize particles and barchart
      }
    })

  d3.select("#time").on("input", updateTime);

  d3.select("#SO2").on("click", function() { updateLinegraph(particles_daily["SO2"], particles_EU["SO2"].limit); });
  d3.select("#NO2").on("click", function() { updateLinegraph(particles_daily["NO2"], particles_EU["NO2"].limit); });
  d3.select("#PM10").on("click", function() { updateLinegraph(particles_daily["PM10"], particles_EU["PM10"].limit); });
  d3.select("#O3").on("click", function() { updateLinegraph(particles_daily["O3"], particles_EU["O3"].limit); });
  d3.select("#CO").on("click", function() { updateLinegraph(particles_daily["CO"], particles_EU["CO"].limit); });
  d3.select("#NOx").on("click", function() { updateLinegraph(particles_daily["NOx"], particles_EU["NOx"].limit); });
  d3.select("#PM25").on("click", function() { updateLinegraph(particles_daily["PM25"], particles_EU["PM25"].limit); });
}


// These objects hold all the magic numbers and elements that need to be
// accessed globally for the entire visualization.
var vis = {
  "current_step": "2017-12-31 20:00",
  "data": {
    "max_value": null,
    "min_value": null,
    "max_percent": 2,
    "min_percent": -2,
    "raw": null,
    "dateIndex": null
  },
  "default": {
    "date": "2017-12-31 20:00",
    "data": null
  },
  "barchart_1": {
    "obj": null,
    "margin": 20,
    "width": 500,
    "height": 100,
    "barpad": 0.2,
    "xScale": null,
    "yScale": null
  },
  "linechart_1": {
    "dataset": null,
    "margin": 25,
    "width": 500,
    "height": 300,
    "xScale": null,
    "yScale": null
  }
}


var parseTime = d3.timeParse("%Y-%m-%d");
var parseTimeISO = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ");

var ParticleField = {}
var Sims = {}

// function visualize(dataHourly) {
//   // Just a sanity check
//   console.log("DataSet", dataHourly)
// 
//   // Build up the initial state of the map visualization.
//   initBarChart1(dataHourly)
// }

// This function organizes the entire visualization.
// It is called after the data files are loaded.
function visualize(dataHourly, dataDaily, particles_EU, dateIndex) {
  // Just a sanity check
  // console.log("DataSet", dataHourly)

  vis.data.raw = dataHourly
  vis.data.dateIndex = dateIndex
  vis.default.data = dateIndex[vis.default.date]

  // Build up the initial state of the map visualization.
  initBarChart1(dataHourly, dateIndex)
  initLineChart1(dataDaily["SO2"], particles_EU["SO2"].limit)
  initParticleField()
}

// function visualize(dataHourly, dateIndex) {
//   vis.data.raw = dataHourly
//   vis.data.dateIndex = dateIndex
//   vis.default.data = dateIndex[vis.default.date]
//   initBarChart1(dataHourly, dateIndex)
//   initParticleField()
// }

function initParticleField() {
  ParticleField.height = 300
  ParticleField.width = 600
  ParticleField.radius = 2.3
  ParticleField.velocity = 1.2
  ParticleField.svg = d3.select("#particle_field")
          .attr('width', ParticleField.width)
          .attr('height', ParticleField.height)

  // see: https://bl.ocks.org/vasturiano/2992bcb530bc2d64519c5b25201492fd
  function onDensityChange(density, pName) {
    Sims[pName].nodes(generateNodes(density, pName))
  }

  function generateNodes(density, pName) {
    var nParticles = Math.round(ParticleField.width * ParticleField.height * density)
    var existingParticles = Sims[pName].nodes()

    // Trim
    if (nParticles < existingParticles.length) {
      return existingParticles.slice(0, nParticles);
    }

    // Append
    return [...existingParticles,
            ...d3.range(nParticles - existingParticles.length).map(() => {
      var angle = Math.random() * 2 * Math.PI
      return {
        x: Math.random() * ParticleField.width,
        y: Math.random() * ParticleField.height,
        vx: Math.cos(angle) * ParticleField.velocity,
        vy: Math.sin(angle) * ParticleField.velocity,
        r: ParticleField.radius
      }
    })];
  }

  function hardLimit(node) {
    // Keep particles inside the bounds of the particle field
    node.x = Math.max(node.r, Math.min(ParticleField.width - node.r, node.x));
    node.y = Math.max(node.r, Math.min(ParticleField.height - node.r, node.y));

    return node;
  }

  function initForces(particleName) {
    return d3.forceSimulation()
      .alphaDecay(0)
      .velocityDecay(0)
      .on('tick', () => { return particleDigest(particleName) })
      .force('bounce', d3.forceBounce().radius(d => d.r))
      .force('container', d3.forceSurface()
        .surfaces([
          {from: {x:0,y:0}, to: {x:0,y:ParticleField.height}},
          {from: {x:0,y:ParticleField.height}, to: {x:ParticleField.width,y:ParticleField.height}},
          {from: {x:ParticleField.width,y:ParticleField.height}, to: {x:ParticleField.width,y:0}},
          {from: {x:ParticleField.width,y:0}, to: {x:0,y:0}}
        ])
        .oneWay(true)
        .radius(d => d.r)
      )
  }

  function particleDigest(particleName) {
    let particleSelector = "circle.particle." + particleName
    // console.log(particleSelector)
    let nodes = Sims[particleName].nodes().map(hardLimit)
    let particles = ParticleField.svg.selectAll(particleSelector).data(nodes)
    // console.log(nodes)
    particles.exit().remove();
    particles.merge(
      particles.enter().append("circle")
        .classed("particle", true)
        .classed(particleName, true)
        .attr('r', d=>d.r)
      )
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
  }

  // Init particles field simulations
  Sims.CO = initForces("CO")
  Sims.O3 = initForces("O3")
  Sims.SO2 = initForces("SO2")
  Sims.PM25 = initForces("PM25")
  Sims.PM10 = initForces("PM10")
  Sims.NOX = initForces("NOX")
  Sims.NO2 = initForces("NO2")

  // Set the initial number of particles in the field
  onDensityChange(0.00004, "CO")
  onDensityChange(0.00005, "O3")
  onDensityChange(0.00004, "SO2")
  onDensityChange(0.00005, "PM25")
  onDensityChange(0.00004, "PM10")
  onDensityChange(0.00005, "NOX")
  onDensityChange(0.00004, "NO2")
}


// This function sets up the main svg element for the map visualization
function initBarChart1(hour, dateIndex) {
  let min = vis.data.min_percent
  let max = vis.data.max_percent
  let width = vis.barchart_1.width
  let height = vis.barchart_1.height
  let margin = vis.barchart_1.margin
  let pad = vis.barchart_1.barpad


  // Setup all the scales that will be needed in the visualization
  let xScale = d3.scaleBand()
    .domain(["CO", "O3", "SO2", "PM10", "PM25", "NOX", "NO2"])
    .range([0, width-margin])
    .padding(pad)
  vis.barchart_1.xScale = xScale

  let yScale = d3.scaleLinear()
    .domain([min, max])
    .range([0, height])
  vis.barchart_1.yScale = yScale

  let barchart = d3.select("#barchart-1")
    .attr("width", width)
    .attr("height", height)
    .classed("barChart", true)
  vis.barchart_1.obj = barchart

  // Add the x axis
  barchart.append("g")
    .attr("id", "barchart_1_x_axis")
    .classed("xAxis", true)
    .attr("transform", "translate(20, 50)")
    .call(d3.axisBottom(xScale))
    // duplicate the text element for each tick
    .selectAll(".tick")
    .select("text")

  // Add and edit the y axis
  barchart.append("g")
    .attr("id", "barchart_1_y_axis")
    .classed("yAxis", true)
    .attr("transform", "translate(20, 0)")
    .call(d3.axisLeft(yScale))
    // transform the given ticks into background grid lines
    .selectAll(".tick")
    .select("line")
    .attr("x1", -6)
    .attr("x2", width)

  barchart.append("g")
    .attr("id", "time-steps")
    .attr("transform", "translate(20, 0)")

  // Add a group for each time-step to organize the bars
  barchart.select("#time-steps")
    .selectAll("g")
    .data([vis.default.data], function(d) {console.log(d)} )
    .enter()
    .append("g")
    .attr("id", encodeDateIDAttr(vis.default.date))
    .classed("timeStep", true)

    // At each time step we now add the bars for each particle type
    .selectAll("rect")
    .data(function(d,i) { return d })
    .enter()
    .append("rect")
    .attr("id", function(d,i) { return d.name })
    .attr("x", function(d,i) { return xScale(d.name) })
    .attr("y", function(d,i) {
      if (d.percent < 0) { return yScale(0) }
      else { return yScale(0 - d.percent) }
      })
    .attr("width", xScale.bandwidth())
    .attr("height", function(d) { return yScale(Math.abs(d.percent)) - 0.5 * height })
    // .attr("class", function(d) {
    //   if (this.parentNode.id == encodeDateIDAttr(vis.default.date)) { return "showBar"}
    //   else { return "hideBar" }
    // })
    .attr("class", function(d) { return d.name })
    .classed("bar", true)



  // barchart.on("click", handle_time_step, 5)  // one step forward
  barchart.on("click", handle_it)  // use this for auto play

}

function handle_it() {
  handle_time_step()
  // d3.interval(handle_time_step, 1500)
}

function initLineChart1(dataset, eu_limit) {
  // format the data
  dataset.forEach(function(d) {
    d.date = new Date(d.date);
  });
  vis.linechart_1.dataset = dataset;

  var date_ranges = d3.extent(dataset, function(d) { return d.date; });

  var xScale = d3.scaleTime()
    .domain(date_ranges)
    .range([0, vis.linechart_1.width]);
  vis.linechart_1.xScale = xScale;

  var yMax = d3.max(dataset, function(d) { return d.value; });
  yMax = Math.max(yMax, eu_limit);

  var yScale = d3.scaleLinear()
    .domain([0, yMax])
    .range([vis.linechart_1.height, 0])
    .nice();
  vis.linechart_1.yScale = yScale;

  // define the line
  var valueline = d3.line()
    .x(function(d) { return xScale(d.date); })
    .y(function(d) { return yScale(d.value); });

  // appends a 'group' element to 'linechart'
  // moves the 'group' element to the top left margin
  var linechart = d3.select("#linechart-1")
    .attr("width", vis.linechart_1.width + 2 * vis.linechart_1.margin)
    .attr("height", vis.linechart_1.height + 2 * vis.linechart_1.margin)
    .append("g")
    .attr("transform", "translate(" + vis.linechart_1.margin + "," + vis.linechart_1.margin + ")");

  // Add the valueline path.
  linechart.append("path")
    .data([dataset])
    .attr("class", "line")
    .attr("d", valueline);

  linechart.append("path")
    .data([[{"date":date_ranges[0], "value":eu_limit}, {"date":date_ranges[1], "value":eu_limit}]])
    .attr("class", "line_eu")
    .attr("stroke", "red")
    .attr("stroke-width", 1.5)
    .attr("d", valueline);

  // Add the X Axis
  linechart.append("g")
    .attr("class", "x-axis")
    .attr("transform", "translate(0," + vis.linechart_1.height + ")")
    .call(d3.axisBottom(xScale).ticks(d3.timeMonth.every(1)).tickFormat(d3.timeFormat("%b")));

  // Add the Y Axis
  linechart.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll('text')
    .text(function(d) {
      return d;
    });

  var tooltip = d3.select("#linechart-tooltip");
  var tooltipLine = linechart.append("line");

  var tipBox = linechart.append("rect")
    .attr("width", vis.linechart_1.width)
    .attr("height", vis.linechart_1.height)
    .attr("opacity", 0)
    .on("mousemove", function() { drawTooltip(vis.linechart_1.dataset, tipBox, tooltipLine, tooltip); })
    .on("mouseout", function() { removeTooltip(tooltip, tooltipLine); });
}

function drawTooltip(dataset, tipBox, tooltipLine, tooltip) {
  var date_start = d3.min(dataset, function(d) { return d.date; });
  var date = vis.linechart_1.xScale.invert(d3.mouse(tipBox.node())[0]);
  var curr_date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var date_id = getDateIndex(date_start, curr_date);

  tooltipLine.attr("stroke", "blue")
    .attr("x1", vis.linechart_1.xScale(curr_date))
    .attr("x2", vis.linechart_1.xScale(curr_date))
    .attr("y1", 0)
    .attr("y2", vis.linechart_1.height);

  tooltip.text("Date: " + formDate(dataset[date_id].date) + ", Value: " + formatNumber(dataset[date_id].value))
    .style("display", "block");
}

function removeTooltip(tooltip, tooltipLine) {
  if (tooltip) {
    tooltip.style("display", "none");
  }

  if (tooltipLine) {
    tooltipLine.attr("stroke", "none");
  }
}

function updateLinegraph(dataset, eu_limit) {
  // format the data
  dataset.forEach(function(d) {
    d.date = new Date(d.date);
  });
  vis.linechart_1.dataset = dataset;

  var date_ranges = d3.extent(dataset, function(d) { return d.date; });

  var xScale = d3.scaleTime()
    .domain(date_ranges)
    .range([0, vis.linechart_1.width]);
  vis.linechart_1.xScale = xScale;

  var yMax = d3.max(dataset, function(d) { return d.value; });
  yMax = Math.max(yMax, eu_limit);

  var yScale = d3.scaleLinear()
    .domain([0, yMax])
    .range([vis.linechart_1.height, 0])
    .nice();
  vis.linechart_1.yScale = yScale;

  // define the line
  var valueline = d3.line()
    .x(function(d) { return vis.linechart_1.xScale(d.date); })
    .y(function(d) { return yScale(d.value); });

  // Select the section we want to apply our changes to
  var linechart = d3.select("#linechart-1").transition();

  // Make the changes
  linechart.select(".line")   // change the line
    .duration(750)
    .attr("d", valueline(dataset));

  linechart.select(".line_eu")
    .duration(750)
    .attr("d", valueline([{"date":date_ranges[0], "value":eu_limit}, {"date":date_ranges[1], "value":eu_limit}]));

  linechart.select(".y-axis") // change the y axis
    .duration(750)
    .call(d3.axisLeft(yScale).ticks(5))
    .selectAll('text')
    .text(function(d) {
      return d;
    });
}

function handle_time_step() {
  // cause a transformation to the next timestep
  let yScale = vis.barchart_1.yScale
  let height = vis.barchart_1.height
  // console.log(this, d3.event, vis.current_step)
  current = vis.current_step
  next = step_n_times(1)

  // hide the current time step
  bars = vis.barchart_1.obj.select(encodeDateIDSelector(current))
    .selectAll("rect")

  bars.transition()
    .duration(800) // in milliseconds
    .attr("y", function(d,i) {
      console.log(d, i, vis.data.dateIndex[next][i]["percent"])
      let newPercent = vis.data.dateIndex[next][i]["percent"]
      if (newPercent < 0) { return yScale(0) }
      else { return yScale(0 - newPercent) }
    })
    .attr("height", function(d,i) {
      let newPercent = vis.data.dateIndex[next][i]["percent"]
      console.log(newPercent, yScale(Math.abs(newPercent)) - 0.5 * height, vis.current_step)
      return yScale(Math.abs(newPercent)) - 0.5 * height
    })

  vis.barchart_1.obj.select(encodeDateIDSelector(current))
    .attr("id", encodeDateIDAttr(next))

  vis.current_step = next
}

function updateTime() {
  var id = d3.select("#time").node().value;
  d3.select("#time_txt").text(getTimeByIndex(id));
}

/* Some useful helper functions */
function step_n_times(n) {
  // console.log("UpdatedCurrentTime:", vis.current_step)
  return moment.utc(vis.current_step).add(n * 30,'m').format("YYYY-MM-DD HH:mm")
}

function encodeDateIDAttr(date) {
  return "D_" + date.replace(' ','_').replace('-','_').replace(':','_')
}

function decodeDateID(dateID) {
  return dateID.slice(1)
}

function getTimeByIndex(id) {
  var data_all = ["00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00", "03:30", "04:00", "04:30", "05:00", "05:30",
                  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
                  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
                  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"];
  return data_all[id];
}

function formatNumber(number) {
  return parseFloat(Math.round(number * 1000) / 1000).toFixed(3);
}

function getDateIndex(first, second) {
  var oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  var firstDate = new Date(first);
  var secondDate = new Date(second);

  var diffDays = Math.round(Math.abs((firstDate.getTime() - secondDate.getTime())/(oneDay))) - 1;
  return diffDays;
}

function formDate(date) {
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var year = date.getFullYear();
  var month = months[date.getMonth()];
  var day = date.getDate();

  if (day < 10) {
    day = "0" + day
  }

  return year + "-" + month + "-" + day;
}

function encodeDateIDSelector(date) {
  return "#" + encodeDateIDAttr(date)
}
