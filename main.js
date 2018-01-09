d3.select(window).on('load', main);

/* Here, we use d3.queue becasue we want to load the data concurrently. However,
   we need to be sure that both data files are done loading before calling
   the visualization function since d3.json is a async call.
   See https://github.com/d3/d3-queue for more details. */
function main(handsJSON) {
  d3.queue()
    .defer(d3.json, "./data/data-hourly.json")  // police districts
    // .defer(d3.json, "sf_crime.geojson")  // criminal occurrences
    .await(function(errMsg, data1) {
    // .await(function(errMsg, data1, data2) {
      if (errMsg) {
        console.log("ERROR: " + errMsg)
      } else {
        visualize(data1)
        // visualize(data1, data2)
      }
    })
}


/* These objects hold all the magic numbers and elements that need to be
   accessed globally for the entire visualization. */
var vis = {
    "barchart_1": {
        "obj": null,
        "width": 400,
        "height": 200,
        "bar_width": 10
    }
}


/* This function organizes the entire visualization. It is called after the
   data files are loaded. */
function visualize(dataHourly) {
  /* Just a sanity check */
  console.log("DataSet", dataHourly)

  /* Build up the initial state of the map visualization. */
  initBarChart1(dataHourly)

}


/* This function sets up the main svg element for the map visualization */
function initBarChart1(hour) {
  vis.barchart_1.obj = d3.select("#barchart-1")
    .attr("width", vis.barchart_1.width)
    .attr("height", vis.barchart_1.height)

  // add a group for each time-step
  vis.barchart_1.obj.selectAll("g")
    .data(hour.data)
    .enter()
    .append("g")
    .attr("id", function(d) { return d.date.id })
    .classed("step", true)
    .append("rect")
    .attr("id", "CO")
    .append("rect")
    .attr("id", "CO2")
    .append("rect")
    .attr("id", "CO3")
    .append("rect")
    .attr("id", "CO4")

  // add the CO bar for each time-step
  vis.barchart_1.obj.selectAll(".step")
    .data(hour.data)
    .append("svg:rect")
    .classed("CO", true)
    .attr("width", 10)
    .attr("height", 20)
    .attr("x", null)
    .attr("y", null)
    .style("fill", "blue")

  // add the O3 bar for each time-step
  vis.barchart_1.obj.selectAll(".step")
    .data(hour.data)
    .append("svg:rect")
    .classed("O3", true)
    .attr("width", 10)
    .attr("height", 20)
    .style("fill", "green")

  // add the NOX bar for each time-step
  vis.barchart_1.obj.selectAll(".step")
    .data(hour.data)
    .append("svg:rect")
    .classed("NOX", true)
    .attr("width", 10)
    .attr("height", 20)
    .style("fill", "red")

}


/* Some useful helper functions */