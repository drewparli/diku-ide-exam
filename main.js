d3.select(window).on('load', main);

// Here, we use d3.queue becasue we want to load the data concurrently. However,
// we need to be sure that both data files are done loading before calling
// the visualization function since d3.json is a async call.
// See https://github.com/d3/d3-queue for more details.
function main() {
  d3.queue()
    .defer(d3.json, "./data/HCAB_2017.json")  // police districts
    .await(function(errMsg, data1, data2, data3) {
      if (errMsg) {
        console.log("ERROR: " + errMsg)
      } else {
        visualize(data1)
      }
    })
}


// These objects hold all the magic numbers and elements that need to be
// accessed globally for the entire visualization.
var DatePicker = null
var BarChart = { }
var Current = { "date": "2017-01-01 00:00" }
var Next = { "date": null }
var Default = { "date": "2017-01-01 00:00" }
var Data = {}
var DateIndex = {}
var ParticleField = {}
var Sims = {}


function visualize(dateIndex) {

  // Some JQuery code to make our bootstrap elements interact with our own elements
  var datepicker = $("#datepicker");
  console.log(datepicker)
  var container=$('.bootstrap-iso form').length>0 ? $('.bootstrap-iso form').parent() : "body";
  datepicker.datepicker({
    format: 'yyyy-mm-dd',
    container: container,
    autoclose: true,
    orientation: "top left",
    startDate: "2017-01-01",
    endDate: "2017-12-31",
  })

  datepicker.datepicker("update", "2017-01-01")

  DatePicker = datepicker

  console.log(datepicker.datepicker('set', "2017-01-01"))

  datepicker.datepicker().on('changeDate', handleDateChange)

  DateIndex = dateIndex
  initBarChart1()
  initParticleField()
  initControls()
}

function initBarChart1() {
  let min = 0
  let max = 5
  let marginLR = 30
  let marginTB = 30
  let base = 30
  let pad = 0.25
  let width = BarChart.width = 595 - marginLR
  let height = BarChart.height = 100
  let particles = DateIndex[Default.date]
  let labels = BarChart.labels = ["NO2", "PM10", "O3", "CO", "SO2", "PM25"]

  let barchart = d3.select("#barchart_frame")
    .attr("width", width + (2 * marginLR))
    .attr("height", height + (2 * marginTB) + base)
    .select("#barchart")
    .classed("barChart", true)
    .attr("transform", "translate(20,30)")

  BarChart.obj = barchart

  // Setup x and y scales
  let xScale = d3.scaleBand()
    .domain(labels)
    .range([0, width])
    .padding(pad)

  let yScale = d3.scaleLinear()
    .domain([min, max])
    .range([height, 0])

  BarChart.yScale = yScale

  // Add the x axis values
  BarChart.xAxisVals = barchart.append("g")
    .attr("id", "barchart_x_values")
    .classed("xAxis", true)
    .attr("transform", "translate(0,102)")
    .call(d3.axisBottom(xScale))

  BarChart.xAxisVals.selectAll("line")
    .remove()

  BarChart.xAxisVals.selectAll("text")
    .classed("value", true)
    .attr("id", function(d) {return d})
    .on("click", handle_bar_toggle)

  BarChart.xAxisVals.selectAll("g")
    .insert("rect")
    .attr("id", function(d) { console.log(d); return d })
    .attr("x", function(d) { return -xScale.bandwidth() * 0.5 })
    .attr("y", function(d) { return 2 })
    .attr("width", xScale.bandwidth())
    .attr("height", function(d) { return 20})
    .attr("class", function(d) { return d })
    .classed("valueBox", true)
    .lower()


  // Add the x axis labels
  BarChart.xAxisLabels = barchart.append("g")
    .attr("id", "barchart_x_labels")
    .classed("xAxis", true)
    .attr("transform", "translate(0,130)")
    .call(d3.axisBottom(xScale))

  BarChart.xAxisLabels.selectAll("line")
    .remove()

  BarChart.xAxisLabels.selectAll("text")
    .classed("label", true)

  // Add and edit the y axis
  barchart.append("g")
    .attr("id", "barchart_y_axis")
    .classed("yAxis", true)
    .call(d3.axisLeft(yScale).ticks(6))
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
    .attr("id", function(d,i) { return d.name })
    .attr("x", function(d,i) { return xScale(d.name) })
    .attr("y", function(d,i) { return yScale(d.caqi) })
    .attr("width", xScale.bandwidth())
    .attr("height", function(d) { return height - yScale(d.caqi) })
    .attr("class", function(d) { return d.name })
    .on("click", handle_bar_toggle)

  setBarChartConcentration(BarChart.xAxisVals, DateIndex[Current.date])

  // barchart.on("click", handle_time_step, 5)  // one step forward
  // barchart.on("click", handle_it)  // use this for auto play
}


function handle_bar_toggle() {
  console.log("click", this.nodeName)
  BarChart.toggle = false

  BarChart.obj.selectAll("rect#" + this.id)
    .classed("barIgnore", function(d) {
      console.log("t", this)
      if (this.classList.contains("barIgnore")) {BarChart.toggle = false} else { BarChart.toggle = true}
      return BarChart.toggle
    })

  // TODO: Turn of this particle too, this works, just need to turn on again
  d3.select("#particle_field")
    .selectAll("circle." + this.__data__.name)
    .classed("particleIgnore", function(d) { return BarChart.toggle })
}


function initParticleField() {
  ParticleField.width = 595
  ParticleField.height = 420
  ParticleField.radius = 2.3
  ParticleField.velocity = 1.4
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

function initControls() {
  d3.select("#play_button")
    .on("click", handlePlay)
  d3.select("#pause_button")
    .on("click", handlePause)
  d3.select("#stop_button")
    .on("click", handleStop)
}


function handleStop() {
  ["CO", "O3", "SO2", "PM25", "PM10", "NO2"].map((p) => Sims[p].stop())
}

function handlePause() {
  BarChart.interval.stop()
}

function handlePlay() {
  handle_time_step()
  BarChart.interval = d3.interval(handle_time_step, 1200)
}

function handleDateChange() {
    new_date = this.value + Current.date.slice(10)
    set_time_step(Current.date, new_date)
}

function handle_time_step() {
  current = Current.date
  Next.date = step_n_times(1)

  set_time_step(current, Next.date)

  DatePicker.datepicker("update", Next.date.slice(0,10))

  Current.date = Next.date
}

function set_time_step(current, next) {

  let yScale = BarChart.yScale
  let height = BarChart.height

  // update the bars in the barchart
  bars = BarChart.obj.select(encodeDateIDSelector(current))
    .selectAll("rect")

  bars.transition()
    .duration(800) // in milliseconds
    .attr("y", function(d,i) {
      let particle = DateIndex[next][i]
      let new_y = particle["caqi"]
      return yScale(new_y)
    })
    .attr("height", function(d,i) {
      let particle = DateIndex[next][i]
      let new_height = particle["caqi"]
      return height - yScale(new_height)
    })

  BarChart.obj.select(encodeDateIDSelector(current))
    .attr("id", encodeDateIDAttr(next))

  setBarChartConcentration(BarChart.xAxisVals, DateIndex[next])

  // Update the concentration of each particle type in the field
  setParticleFieldConcentration(DateIndex[next])
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
  return 0.0000005 * value
}

function roundTwo(num) {
    return +(Math.round(num + "e+2")  + "e-2");
}

function setBarChartConcentration(selection, values) {
  selection.selectAll(".tick")
    .select("text")
    .data(values)
    .text(function(d) {
        c = d.value
        if (c == "null") {return "missing"} else {return roundTwo(c)} } )
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
      .classed("particleIgnore", function() { return BarChart.toggle })
      .attr('r', function (d) {
        if (particleName == "PM10" || particleName == "O3" || particleName == "NO2")  {return d.r * 1.5}
        else {return d.r } }))
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);
}