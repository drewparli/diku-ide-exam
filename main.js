d3.select(window).on('load', main);

// Here, we use d3.queue becasue we want to load the data concurrently. However,
// we need to be sure that both data files are done loading before calling
// the visualization function since d3.json is a async call.
// See https://github.com/d3/d3-queue for more details.
function main() {
  d3.queue()
    .defer(d3.json, "./data/data-hourly-2.json")  // police districts
    .defer(d3.json, "./data/date-index.json")
    .await(function(errMsg, data1, data2) {
      if (errMsg) {
        console.log("ERROR: " + errMsg)
      } else {
        visualize(data1, data2)
      }
    })
}


// These objects hold all the magic numbers and elements that need to be
// accessed globally for the entire visualization.
var BarChart = { }
var Current = { "date": "2017-12-31 20:00" }
var Next = { "date": null }
var Default = { "date": "2017-12-31 20:00" }
var Data = {}
var DateIndex = {}
var ParticleField = {}
var Sims = {}


function visualize(dataHourly, dateIndex) {
  DateIndex = dateIndex
  initBarChart1()
  // initParticleField()
}

function initBarChart1() {
  let min = -2
  let max = 2
  let width = 800
  let height = 100
  let marginLR = 30
  let marginTB = 10
  let base = 30
  let pad = 0.2
  let particles = DateIndex[Default.date]

  let barchart = d3.select("#barchart_frame")
    .attr("width", width + (2 * marginLR))
    .attr("height", height + (2 * marginTB) + base)
    .select("#barchart")
    .classed("barChart", true)
    .attr("transform", "translate(30,10)")

  BarChart.obj = barchart

  // Setup x and y scales
  let xScale = d3.scaleBand()
    .domain(["CO", "O3", "SO2", "PM10", "PM25", "NOX", "NO2"])
    .range([0, width])
    .padding(pad)

  let yScale = d3.scaleLinear()
    .domain([min, max])
    .range([0, height])

  // Add the x axis values
  BarChart.xAxisVals = barchart.append("g")
    .attr("id", "barchart_x_values")
    .classed("xAxis", true)
    .attr("transform", "translate(0,100)")
    .call(d3.axisBottom(xScale))

  BarChart.xAxisVals.selectAll("line")
    .remove()

  // Add the x axis labels
  BarChart.xAxisLabels = barchart.append("g")
    .attr("id", "barchart_x_labels")
    .classed("xAxis", true)
    .attr("transform", "translate(0,114)")
    .call(d3.axisBottom(xScale))

  BarChart.xAxisLabels.selectAll("line")
    .remove()

  BarChart.xAxisLabels.selectAll("text")
    .classed("pLabel", true)
    .on("click", handle_label_toggle)

  // Add and edit the y axis
  barchart.append("g")
    .attr("id", "barchart_y_axis")
    .classed("yAxis", true)
    .call(d3.axisLeft(yScale))
    // transform the given ticks into background grid lines
    .selectAll(".tick")
    .select("line")
    .attr("x1", -6)
    .attr("x2", width)

  barchart.append("g")
    .attr("id", "time-steps")

  // Add a group for each time-step to organize the bars
  barchart.select("#time-steps")
    .append("g")
    .attr("id", encodeDateIDAttr(Default.date))
    .classed("timeStep", true)

    // At each time step we now add the bars for each particle type
    .selectAll("rect")
    .data(particles)
    .enter()
    .append("rect")
    .attr("id", function(d,i) { return d.name + "_bar" })
    .attr("x", function(d,i) { return xScale(d.name) })
    .attr("y", function(d,i) {
      if (d.percent < 0) { return yScale(0) }
      else { return yScale(0 - d.percent) }
      })
    .attr("width", xScale.bandwidth())
    .attr("height", function(d) {
      return yScale(Math.abs(d.percent)) - 0.5 * height
    })
    .attr("class", function(d) { return d.name })
    .on("click", handle_bar_toggle)

  setBarChartConcentration(BarChart.xAxisVals, DateIndex[Current.date])

  // barchart.on("click", handle_time_step, 5)  // one step forward
  // barchart.on("click", handle_it)  // use this for auto play
}

function handle_bar_toggle() {
  console.log(this, this.__data__.name, ParticleField.svg)
  BarChart.obj.select("#" + this.id)
    .classed("barIgnore", function(d) {
      if (this.classList.contains("barIgnore")) { return false} else { return true} })

  // TODO: Turn of this particle too, this works, just need to turn on again
  d3.select("#particle_field")
    .selectAll("circle." + this.__data__.name)
    .classed("particleIgnore", true)
}

function handle_label_toggle() {
  console.log(this)
  BarChart.obj.select("#" + this.__data__ + "_bar")
    .classed("barIgnore", function(d) {
      if (this.classList.contains("barIgnore")) { return false} else { return true} })
  // ParticleField.svg.selectAll(".particle")
  //   .selectAll("." + this.__data__)
  //   .classed("particleIgnore")
}


function initParticleField() {
  ParticleField.width = 800
  ParticleField.height = 300
  ParticleField.radius = 2.3
  ParticleField.velocity = 1.2
  ParticleField.svg = d3.select("#particle_field")
          .attr('width', ParticleField.width)
          .attr('height', ParticleField.height)

  // Init particles field simulations
  Sims.CO = initForces("CO")
  Sims.O3 = initForces("O3")
  Sims.SO2 = initForces("SO2")
  Sims.PM25 = initForces("PM25")
  Sims.PM10 = initForces("PM10")
  Sims.NOX = initForces("NOX")
  Sims.NO2 = initForces("NO2")

  // Set the initial concentration of each particle type in the field
  setParticleFieldConcentration(DateIndex[Current.date])
}


function handle_it() {
  handle_time_step()
  // d3.interval(handle_time_step, 1500)
}


function handle_time_step() {
  // cause a transformation to the next timestep
  let yScale = vis.barchart_1.yScale
  let height = vis.barchart_1.height
  current = Current.date
  Next.date = step_n_times(1)

  // hide the current time step
  bars = BarChart.obj.select(encodeDateIDSelector(current))
    .selectAll("rect")

  bars.transition()
    .duration(800) // in milliseconds
    .attr("y", function(d,i) {
      let particle = DateIndex[Next.date][i]
      let newPercent = particle["percent"]
      if (newPercent < 0) { return yScale(0) }
      else { return yScale(0 - newPercent) }
    })
    .attr("height", function(d,i) {
      let newPercent = DateIndex[Next.date][i]["percent"]
      return yScale(Math.abs(newPercent)) - 0.5 * height
    })

  BarChart.obj.select(encodeDateIDSelector(current))
    .attr("id", encodeDateIDAttr(Next.date))

  setBarChartConcentration(BarChart.xAxisVals, DateIndex[Next.date])

  // Update the concentration of each particle type in the field
  setParticleFieldConcentration(DateIndex[Next.date])

  Current.date = Next.date
}


/* Some useful helper functions */
function step_n_times(n) {
  return moment.utc(Current.date).add(n * 30,'m').format("YYYY-MM-DD HH:mm")
}

function encodeDateIDAttr(date) {
  return "D_" + date.replace(' ','_').replace('-','_').replace(':','_')
}

function encodeDateIDSelector(date) {
  return "#" + encodeDateIDAttr(date)
}

function scaleConcentration(value) {
  return 0.00003 * value
}

function setBarChartConcentration(selection, values) {
  selection.selectAll(".tick")
    .select("text")
    .data(values)
    .text(function(d) { return d.percent } )
}

function setParticleFieldConcentration(particles) {
  var n = particles.length
  for (var i = 0; i < n; i++) {
    pName = particles[i].name
    value = particles[i].value
    c = scaleConcentration(parseFloat(value))
    onDensityChange(c, pName)
  }
}




////////////////////////////////////////////////////////////////////////////////
// THIS IS BORROWED CODE
// see: https://bl.ocks.org/vasturiano/2992bcb530bc2d64519c5b25201492fd
////////////////////////////////////////////////////////////////////////////////
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
  let nodes = Sims[particleName].nodes().map(hardLimit)
  let particles = ParticleField.svg.selectAll(particleSelector).data(nodes)
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