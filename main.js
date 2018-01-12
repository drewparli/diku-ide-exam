d3.select(window).on('load', main);

// Here, we use d3.queue becasue we want to load the data concurrently. However,
// we need to be sure that both data files are done loading before calling
// the visualization function since d3.json is a async call.
// See https://github.com/d3/d3-queue for more details.
function main(handsJSON) {
  d3.queue()
    .defer(d3.json, "./data/data-hourly-2.json")  // police districts
    .defer(d3.json, "./data/date-index.json")
    // .await(function(errMsg, data1) {
    .await(function(errMsg, data1, data2) {
      if (errMsg) {
        console.log("ERROR: " + errMsg)
      } else {
        // visualize(data1)
        visualize(data1, data2)
      }
    })
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
  }
}


// This function organizes the entire visualization.
// It is called after the data files are loaded.
function visualize(dataHourly, dateIndex) {
  // Just a sanity check
  // console.log("DataSet", dataHourly)

  // Build up the initial state of the map visualization.
  vis.data.raw = dataHourly
  vis.data.dateIndex = dateIndex
  vis.default.data = dateIndex[vis.default.date]

  initBarChart1(dataHourly, dateIndex)
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
  vis.barchart_1.obj = barchart


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

  // Add the x axis
  barchart.append("g")
    .attr("id", "x")
    .attr("transform", "translate(20, 100)")
    .call(d3.axisBottom(xScale))

  // Add and edit the y axis
  barchart.append("g")
    .attr("id", "y")
    .attr("transform", "translate(20, 0)")
    .call(d3.axisLeft(yScale))
    // transform the given ticks into background grid lines
    .selectAll(".tick")
    .select("line")
    .attr("x1", -6)
    .attr("x2", width)
    .style("stroke", "rgba(0,0,0,0.2)")

  // barchart.on("click", handle_time_step, 5)  // one step forward
  barchart.on("click", handle_it)  // use this for auto play

}

function handle_it() {
  handle_time_step()
  d3.interval(handle_time_step, 1500)
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


/* Some useful helper functions */
function step_n_times(n) {
  // console.log("UpdatedCurrentTime:", vis.current_step)
  return moment.utc(vis.current_step).add(n * 30,'m').format("YYYY-MM-DD HH:mm")
}

function encodeDateIDAttr(date) {
  return "D_" + date.replace(' ','_').replace('-','_').replace(':','_')
}

function encodeDateIDSelector(date) {
  return "#" + encodeDateIDAttr(date)
}