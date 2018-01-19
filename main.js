d3.select(window).on('load', main);

// Here, we use d3.queue becasue we want to load the data concurrently. However,
// we need to be sure that both data files are done loading before calling
// the visualization function since d3.json is a async call.
// See https://github.com/d3/d3-queue for more details.
function main(handsJSON) {
  d3.queue()
    .defer(d3.json, "./data/data-hourly.json")  // police districts
    .defer(d3.json, "./data/data-daily.json")
    .defer(d3.json, "./data/HCAB_2017.json")  // police districts
    .await(function(errMsg, hourly, daily, HCAB) {
      if (errMsg) {
        console.log("ERROR: " + errMsg)
      } else {
        particles_daily = daily;
        particles_EU = hourly.parts;
        visualize(hourly, daily, particles_EU, HCAB) // Visualize emission graph
      }
    })
}

// These objects hold all the magic numbers and elements that need to be
// accessed globally for the entire visualization.
// DREWS GLOBAL VARIABLES
var DatePicker = null
var BarChart = { }
var Current = { "date": "2017-01-01 00:00" }
var Next = { "date": null }
var Default = { "date": "2017-01-01 00:00" }
var Data = {}
var DateIndex = {}
var ParticleField = {}
var Sims = {}

// VIKS GLOBAL VARIABLES
var particles_daily;
var particles_EU;
var LineChart = {
  "dataset": null,
  "margin": 25,
  "width": 500,
  "height": 300,
  "xScale": null,
  "yScale": null
}

// [very low, low, medium, high, very high (just set for line chart although it is infinity)]
var QualityIndex = {
  "SO2": [50, 100, 350, 500, 650],
  "NO2": [50, 100, 200, 400, 600],
  "PM10": [15, 30, 50, 100, 160],
  "O3": [60, 120, 180, 240, 300],
  "CO": [5000, 7500, 10000, 20000, 30000],
  "PM25": [10, 20, 30, 60, 90]
}

var parseTime = d3.timeParse("%Y-%m-%d");
var parseTimeISO = d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ");

// This function organizes the entire visualization.
// It is called after the data files are loaded.
function visualize(dataHourly, dataDaily, particles_EU, dateIndex) {
  // JQuery code to make our bootstrap date picker work
  var datepicker = $("#datepicker")
  console.log(datepicker)
  var container=$('.inpute-group').length>0 ? $('.input-group').parent() : "body";
  datepicker.datepicker({
    format: 'yyyy-mm-dd',
    container: container,
    autoclose: true,
    orientation: "top right",
    startDate: "2017-01-01",
    endDate: "2017-12-31",
  })
  datepicker.datepicker("update", "2017-01-01")
  datepicker.datepicker().on('changeDate', handleDateChange)
  DatePicker = datepicker

  // JQuery code to make our bootstrap tabs work
  $(".nav a").on("click", function() {
    $(".nav").find(".active").removeClass("active")
    $(this).parent().addClass("active")
  })

  // d3 code to create our visualizations

  DateIndex = dateIndex;
  initBarChart()
  initParticleField()
  initControls()
  initLineChart(dataDaily["SO2"], QualityIndex.SO2)
}

// This function sets up the main svg element for the map visualization
function initBarChart() {
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
    .attr("id", function(d) { return d })
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
  d3.select("#time").on("input", updateTime);
}

function initLineChart(dataset, eu_limit) {
  // Add functionality to the predefined HTML elements
  buttons = d3.select("#linechart-buttons")
  buttons.select("#SO2").on("click", updateLinegraph)
  buttons.select("#NO2").on("click", updateLinegraph)
  buttons.select("#PM10").on("click", updateLinegraph)
  buttons.select("#O3").on("click", updateLinegraph)
  buttons.select("#CO").on("click", updateLinegraph)
  // buttons.select("#NOx").on("click", updateLinegraph)
  buttons.select("#PM25").on("click", updateLinegraph)

  // format the data
  dataset.forEach(function(d) {
    d.date = new Date(d.date);
  });
  LineChart.dataset = dataset;

  var date_ranges = d3.extent(dataset, function(d) { return d.date; });

  var xScale = d3.scaleTime()
    .domain(date_ranges)
    .range([0, LineChart.width]);
  LineChart.xScale = xScale;

  var yMax = 2 * d3.max(dataset, function(d) { return d.value; });
  yMax = Math.max(yMax, eu_limit[1]);

  var tick_values = [0]
  for (i = 0; i < eu_limit.length; i++) {
	if (eu_limit[i] <= yMax) {
      tick_values.push(eu_limit[i]);
	}
  };
  
  yMax = tick_values[tick_values.length-1]
  
  if (tick_values[tick_values.length-1] == eu_limit[4]) {
    tick_values.pop()
  }
  
  console.log(yMax)
  var yScale = d3.scaleLinear()
    .domain([0, yMax])
    .range([LineChart.height, 0])
    .nice();
  LineChart.yScale = yScale;

  var area = d3.area()
    .x(function(d) { return LineChart.xScale(d.date); })
    .y0(LineChart.height)
    .y1(function(d) { return LineChart.yScale(d.value); });

  var dataset_very_high = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[4])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[4])}];
  var dataset_high = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[3])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[3])}];
  var dataset_medium = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[2])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[2])}];
  var dataset_low = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[1])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[1])}];
  var dataset_very_low = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[0])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[0])}];

  // define the line
  var valueline = d3.line()
    .x(function(d) { return xScale(d.date); })
    .y(function(d) { return yScale(d.value); });

  // appends a 'group' element to 'linechart'
  // moves the 'group' element to the top left margin
  var linechart = d3.select("#linechart-1")
    .attr("width", LineChart.width + 2 * LineChart.margin)
    .attr("height", LineChart.height + 3 * LineChart.margin)
    .append("g")
    .attr("transform", "translate(" + (2 * LineChart.margin) + "," + LineChart.margin + ")");

  linechart.append("path")
    .data([dataset_very_high])
    .attr("class", "area_very_high")
    .attr("d", area)
	.style("fill", "#DB4A36");

  linechart.append("path")
    .data([dataset_high])
    .attr("class", "area_high")
    .attr("d", area)
	.style("fill", "#E88D3F");
	
  linechart.append("path")
    .data([dataset_medium])
    .attr("class", "area_medium")
    .attr("d", area)
	.style("fill", "#FFD966");

  linechart.append("path")
    .data([dataset_low])
    .attr("class", "area_low")
    .attr("d", area)
	.style("fill", "#A4B963");	

  linechart.append("path")
    .data([dataset_very_low])
    .attr("class", "area_very_low")
    .attr("d", area)
	.style("fill", "#2B9B5C");	

  linechart.append("path")
    .data([dataset])
    .attr("class", "area")
    .attr("d", area);

  // Title
  linechart.append("text")
    .attr("x", (LineChart.width / 2))             
    .attr("y", 0 - (LineChart.margin / 2))
    .attr("text-anchor", "middle")  
    .style("font-size", "16px")
    .text("Daily Air Pollution in 2017");

  // Add the X Axis
  linechart.append("g")
    .attr("class", "x-axis")
    .attr("transform", "translate(0," + LineChart.height + ")")
    .call(d3.axisBottom(xScale).ticks(d3.timeMonth.every(1)).tickFormat(d3.timeFormat("%b")));

  // Add the Y Axis
  linechart.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale).tickValues(tick_values))
    .selectAll('text')
    .text(function(d) {
      return d;
    });

  // Text label for the Y axis
  linechart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -LineChart.margin)
    .attr("x", -LineChart.height/2)
    .attr("dy", "-1em")
    .style("text-anchor", "middle")
    .text("Concentration (µg/m³)");

  var tooltipLine = linechart.append("line");

  var tipBox = linechart.append("rect")
    .attr("width", LineChart.width)
    .attr("height", LineChart.height)
    .attr("opacity", 0)
    .on("mousemove", function() { drawTooltip(LineChart.dataset, tipBox, tooltipLine); })
    .on("mouseout", function() { removeTooltip(tooltipLine); });
}




////////////////////////////////////////////////////////////////////////////////
// d3 HANDLERS
////////////////////////////////////////////////////////////////////////////////
function handle_bar_toggle() {
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



////////////////////////////////////////////////////////////////////////////////
// HELPER FUNCTIONS
////////////////////////////////////////////////////////////////////////////////
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

  flashWarningIfHigh(DateIndex[next])
}

function updateTime() {
  var id = d3.select("#time").node().value;
  d3.select("#time_txt").text(getTimeByIndex(id));

  animateTimeFrame(getTimeByIndex(id))
}

function animateTimeFrame(time) {
  var color = "#fff"
  var hour = Number(time.slice(0,2))

  if (hour > 22 || hour <= 3)
    color = "#001318"
  if ((hour <= 22 && hour > 21) || (hour > 3 && hour <= 4))
    color = "#CC7D00"
  if ((hour <= 21 && hour > 19) || (hour > 4 && hour <= 8))
    color = "#00BCE4"
  if (hour <= 19 && hour > 8)
    color = "#99EDFF"

  d3.select("#sky")
    .attr("fill",color)
}

function step_n_times(n) {
  return moment.utc(Current.date).add(n * 30,'m').format("YYYY-MM-DD HH:mm")
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

  var diffDays = Math.round(Math.abs((firstDate.getTime() - secondDate.getTime())/(oneDay)));
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

function flashWarningIfHigh(values) {
  var text = ""
  var superWarningValues = values.filter(w => w.caqi == 5)
  if (superWarningValues.length > 0) {
    var valueNames = superWarningValues.map(w => w.name)
    text = "WARNING: VERY HIGH concentration of " + valueNames.join(", ") + "!"
  }
  else {
    var warningValues = values.filter(w => w.caqi == 4)
    if (warningValues.length > 0) {
      var valueNames = warningValues.map(w => w.name)
      text = "WARNING: High concentration of " + valueNames.join(", ")
    }
  }

  if (text != "") {
    d3.select("#warning_top")
      .attr("visibility", "visibile")

    d3.select("#warning_text")
      .html(text)
  }
  else {
    d3.select("#warning_top")
      .attr("visibility", "hidden")
  }
}



function drawTooltip(dataset, tipBox, tooltipLine) {
  var date_start = d3.min(dataset, function(d) { return d.date; });
  var date = LineChart.xScale.invert(d3.mouse(tipBox.node())[0]);
  var curr_date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var date_id = getDateIndex(date_start, curr_date);

  tooltipLine.attr("stroke", "#0052FF")
    .attr("x1", LineChart.xScale(curr_date))
    .attr("x2", LineChart.xScale(curr_date))
    .attr("y1", 0)
    .attr("y2", LineChart.height);

  d3.select("#linechart-tooltip-box")
    .attr("x", LineChart.width - 3.7 * LineChart.margin)
	.attr("y", 1.5 * LineChart.margin)
	.style("background-color", "white")
	.style("display", "block")
	.raise();

  d3.select("#linechart-tooltip-date")
    .text("Date: " + formDate(dataset[date_id].date));

  d3.select("#linechart-tooltip-value")
    .text("Value: " + formatNumber(dataset[date_id].value));
}

function removeTooltip(tooltipLine) {
  tooltip = d3.select("#linechart-tooltip-box")
  
  if (tooltip) {
    tooltip.style("display", "none");
  }

  if (tooltipLine) {
    tooltipLine.attr("stroke", "none");
  }
}

// function updateLinegraph(dataset, eu_limit) {
function updateLinegraph() {
  dataset = particles_daily[this.id]
  eu_limit = QualityIndex[this.id]

  // format the data
  dataset.forEach(function(d) {
    d.date = new Date(d.date);
  });
  LineChart.dataset = dataset;

  var date_ranges = d3.extent(dataset, function(d) { return d.date; });

  var xScale = d3.scaleTime()
    .domain(date_ranges)
    .range([0, LineChart.width]);
  LineChart.xScale = xScale;

  var yMax = 2 * d3.max(dataset, function(d) { return d.value; });
  yMax = Math.max(yMax, eu_limit[1]);

  var tick_values = [0]
  for (i = 0; i < eu_limit.length; i++) {
	if (eu_limit[i] <= yMax) {
      tick_values.push(eu_limit[i]);
	}
  };
  
  yMax = tick_values[tick_values.length-1]
  
  if (tick_values[tick_values.length-1] == eu_limit[4]) {
    tick_values.pop()
  }
  
  var yScale = d3.scaleLinear()
    .domain([0, yMax])
    .range([LineChart.height, 0])
    .nice();
  LineChart.yScale = yScale;

  var area = d3.area()
    .x(function(d) { return LineChart.xScale(d.date); })
    .y0(LineChart.height)
    .y1(function(d) { return yScale(d.value); });

  // define the line
  var valueline = d3.line()
    .x(function(d) { return LineChart.xScale(d.date); })
    .y(function(d) { return yScale(d.value); });

  // Select the section we want to apply our changes to
  var linechart = d3.select("#linechart-1").transition();

  var dataset_very_high = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[4])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[4])}];
  var dataset_high = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[3])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[3])}];
  var dataset_medium = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[2])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[2])}];
  var dataset_low = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[1])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[1])}];
  var dataset_very_low = [{"date": date_ranges[0], "value": Math.min(yMax, eu_limit[0])}, {"date": date_ranges[1], "value": Math.min(yMax, eu_limit[0])}];

    // Add the valueline path.
  linechart.select(".area_very_high")
    .duration(750)
    .attr("d", area(dataset_very_high));

  // Add the valueline path.
  linechart.select(".area_high")
    .duration(750)
    .attr("d", area(dataset_high));
	
  // Add the valueline path.
  linechart.select(".area_medium")
    .duration(750)
    .attr("d", area(dataset_medium));
	
  // Add the valueline path.
  linechart.select(".area_low")
    .duration(750)
    .attr("d", area(dataset_low));	

  // Add the valueline path.
  linechart.select(".area_very_low")
    .duration(750)
    .attr("d", area(dataset_very_low));	
  
  // Make the changes
  linechart.select(".area")   // change the line
    .duration(750)
    .attr("d", area(dataset));

  linechart.select(".y-axis") // change the y axis
    .duration(750)
    .call(d3.axisLeft(yScale).tickValues(tick_values))
    .selectAll('text')
    .text(function(d) {
      return d;
    });
}




////////////////////////////////////////////////////////////////////////////////
// ADAPTED CODE - ENTROPY EXAMPLE
// see https://bl.ocks.org/vasturiano/2992bcb530bc2d64519c5b25201492fd
// This code was borrowed to visualize the particle field, however new
// parameters have been added to allow the code to be used in a more general
// manner. Also, certain portions of the code have been simplified due to the
// values used in our implementation.
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
    .on('tick', () => { return particleDigest(particleName) })  // This is one of the biggest updates I made
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