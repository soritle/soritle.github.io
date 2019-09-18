
function create_MCU_chart() {

    ////////////////////////////////////////////////////////////// 
    ////////////////// Set-up sizes of the page //////////////////
    ////////////////////////////////////////////////////////////// 
    
    var container = d3.select("#chart");
    
    window.scroll(0,window.pageYOffset);
    //Remove anything that was still there
    container.selectAll("svg, canvas").remove();
    container.style("height", null);
    document.body.style.width = null;

    var base_width = 1600;
    var ww = window.innerWidth,
        wh = window.innerHeight;
    var width_too_small = ww < 500;

    var width;
    if(wh < ww) {
        width = wh/0.7;
    } else {
        if(ww < width_too_small) width = ww/0.5;
        else if(ww < 600) width = ww/0.6;
        else if(ww < 800) width = ww/0.7;
        else if(ww < 1100) width = ww/0.8;
        else width = ww/0.8;
    }//else
    width = Math.round(Math.min(base_width, width));
    var height = width;

    //Scaling the entire visual, as compared to the base size
    var size_factor = width/base_width;

    //Adjust the general layout based on the width of the visual
    container.style("height", height + "px");
    //Reset the body width
    var annotation_padding = width_too_small ? 0 : 240 * size_factor;
    var total_chart_width = width + annotation_padding;
    var no_scrollbar_padding = total_chart_width > ww ? 0 : 20;
    if(total_chart_width > ww) document.body.style.width = total_chart_width + 'px';
    var outer_container_width = Math.min(base_width, ww - no_scrollbar_padding - 2*20); //2 * 20px padding

    //Move the window to the top left of the text if the chart is wider than the screen
    if(total_chart_width > ww) {
        var pos = document.getElementById("top-outer-container").getBoundingClientRect();
        var scrollX = pos.left - 15;
        if(total_chart_width - ww < pos.left) {
            scrollX = (total_chart_width - ww)/2; 
        } else if(outer_container_width >= base_width) scrollX = pos.left - (parseInt(document.body.style.width) - pos.width)/4 - 10;
        //Scroll to the new position on the horizontal
        window.scrollTo(scrollX,window.pageYOffset);

        //This doesn't work in all browsers, so check (actually it only doesn't seem to work in Chrome mobile...)
        if( Math.abs(window.scrollX - scrollX) > 2 ) {
            window.scrollTo(0,window.pageYOffset)
            d3.selectAll(".outer-container")
                .style("margin-left", 0 + "px")
                .style("margin-right", 0 + "px")
                .style("padding-left", 30 + "px")
                .style("padding-right", 30 + "px")
        }//if
    }//if

    document.querySelector('html').style.setProperty('--annotation-title-font-size', Math.min(14,15*size_factor) + 'px')
    document.querySelector('html').style.setProperty('--annotation-label-font-size', Math.min(14,15*size_factor) + 'px')

    ////////////////////////////////////////////////////////////// 
    //////////////////// Create SVG & Canvas /////////////////////
    ////////////////////////////////////////////////////////////// 

    //Canvas
    var canvas = container.append("canvas").attr("id", "canvas-target")
    var ctx = canvas.node().getContext("2d");
    crispyCanvas(canvas, ctx, 2);
    ctx.translate(width/2,height/2);
    //General canvas settings
    ctx.globalCompositeOperation = "multiply";
    ctx.lineCap = "round";
    ctx.lineWidth = 3 * size_factor;

    //SVG container
    var svg = container.append("svg")
        .attr("id","MCU-SVG")
        .attr("width", width)
        .attr("height", height);

    var chart = svg.append("g")
        .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")");

    // //Test to see the window width on mobile
    // chart.append("text")
    //     .attr("x", -width/2 + 20)
    //     .attr("y", -height/2 + 20)
    //     .style("fill","black")
    //     .text(ww)

    var defs = chart.append("defs");

    //////////////////////////////////////////////////////////////
    //////////////// Initialize helpers and scales ///////////////
    //////////////////////////////////////////////////////////////

    var num_movies = 24,
        num_phase = 4;
    var pi2 = 2*Math.PI,
        pi1_2 = Math.PI/2;

    var cover_alpha = 0.3;
    var simulation;
    var remove_text_timer;

    //Has a mouseover just happened
    var mouse_over_in_action = false;

    //Radii at which the different parts of the visual should be created
    var rad_card_label = width * 0.35, //capture card text on the outside
        rad_cover_outer = width * 0.395, //outside of the hidden cover hover
        rad_cover_inner = width * 0.350, //inside of the hidden cover hover
        // rad_phase_donut_outer = width * 0.427, //outer radius of the phase donut
        // rad_phase_donut_inner = width * 0.425, //inner radius of the phase donut
        rad_color = width * 0.373, //color circles' center
        rad_movie_outer = width * 0.3499, //outside of the hidden movie hover
        rad_phase_inner = width * 0.343, //radius of the phase arcs
        rad_movie_donut_outer = width * 0.334, //outer radius of the movie donut
        rad_movie_donut_inner = width * 0.32, //inner radius of the movie donut
        rad_movie_inner = width * 0.30, //outside of the hidden movie hover
        rad_dot_color = width * 0.32, //movie dot
        rad_line_max = 0.31,
        rad_line_min = 0.215,
        rad_line_label = width * 0.29, //textual label that explains the hovers
        rad_donut_inner = width * 0.122, //inner radius of the hero donut
        rad_donut_outer = width * 0.13, //outer radius of the hero donut
        rad_name = rad_donut_outer + 8 * size_factor, //padding between hero donut and start of the hero name
        rad_image = rad_donut_inner - 4 * size_factor; //radius of the central image shown on hover
        rad_relation = rad_donut_inner - 8 * size_factor; //padding between hero donut and inner lines

    //Angle for each movie on the outside
    var angle = d3.scaleLinear()
        .domain([0, num_movies])
        .range([pi2/num_movies/2, pi2 + pi2/num_movies/2]);

    //Radius scale for the color circles
    var radius_scale = d3.scaleSqrt()
        .domain([0, 1])
        .range([0, 20]);

    ///////////////////////////////////////////////////////////////////////////
    ///////////////////////////// Create groups ///////////////////////////////
    ///////////////////////////////////////////////////////////////////////////


    ///////////////////////////////////////////////////////////////////////////
    //////////////////////////// Read in the data /////////////////////////////
    ///////////////////////////////////////////////////////////////////////////

    d3.queue()
        .defer(d3.json, "./data/movie_hierarchy.json")
        .defer(d3.json, "./data/movie_total.json")
        .defer(d3.json, "./data/hero_per_movie.json")
        .defer(d3.csv, "./data/hero_total.csv")
        .defer(d3.csv, "./data/hero_relations.csv")
        .await(draw);

    function draw(error, movie_hierarchy_data, movie_total_data, hero_data, hero_total_data, relation_data) {

        if (error) throw error;

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Calculate movie locations /////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        movie_hierarchy_data = movie_hierarchy_data.filter(function (d) { return d.name === "MCU" || (d.phase_num <= num_phase && !d.num) || (d.num >= 1 && d.num <= num_movies); });
        //Based on typical hierarchical clustering example
        var root = d3.stratify()
            .id(function (d) { return d.name; })
            .parentId(function (d) { return d.parent; })
            (movie_hierarchy_data);
        var cluster = d3.cluster()
            .size([360, rad_dot_color])
            .separation(function separation(a, b) {
                return a.parent == b.parent ? 1 : 1.3;
            });
        cluster(root);
        var movie_location_data = root.leaves()
        movie_location_data.forEach(function (d, i) {
            d.centerAngle = d.x * Math.PI / 180;
        });

        //The distance between two movies that belong to the same phase
        var movie_angle_distance = movie_location_data[1].centerAngle - movie_location_data[0].centerAngle;

        //Add some useful metrics to the movie data
        movie_location_data.forEach(function (d, i) {
            d.startAngle = d.centerAngle - movie_angle_distance / 2;
            d.endAngle = d.centerAngle + movie_angle_distance / 2;
        })

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Final data prep /////////////////////////////
        ///////////////////////////////////////////////////////////////////////////

        hero_total_data.forEach(function (d) {
            d.num_movies = +d.num_movies;
        })//forEach
        var hero_names = hero_total_data.map(function(d) { return d.hero; });

        //Sort cover data according to heroes from total
        function sortHero(a, b) { return hero_names.indexOf(a.hero) - hero_names.indexOf(b.hero); }
        hero_data.sort(sortHero);

        //////////////////////////////////////////////////////////////
        /////////////// Create circle for cover image ////////////////
        //////////////////////////////////////////////////////////////

        //Adding images of the heroes
        var image_radius = rad_image;
        var image_group = defs.append("g").attr("class", "image-group");
        //Had to add img width otherwise it wouldn't work in Safari & Firefox
        //http://stackoverflow.com/questions/36390962/svg-image-tag-not-working-in-safari-and-firefox
        var cover_image = image_group.append("pattern")
            .attr("id", "cover-image")
            .attr("class", "cover-image")
            .attr("patternUnits", "objectBoundingBox")
            .attr("height", "100%")
            .attr("width", "100%")
            .append("image")
            .attr("xlink:href", "img/white-square.jpg")
            .attr("height", 2 * image_radius)
            .attr("width", 2 * image_radius);

        ///////////////////////////////////////////////////////////////////////////
        /////////////////////// Create hero donut chart //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Arc command for the hero donut chart
        var arc = d3.arc()
            .outerRadius(rad_donut_outer)
            .innerRadius(rad_donut_inner)
            .padAngle(0.01)
            .cornerRadius((rad_donut_outer - rad_donut_inner) / 2 * 1)
        //Pie function to calculate sizes of donut slices
        var pie = d3.pie()
            .sort(null)
            .value(function (d) { return d.num_movies; });

        var arcs = pie(hero_total_data);
        arcs.forEach(function(d,i) {
            d.hero = hero_total_data[i].hero;
            d.centerAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle;
        });

        //Create the donut slices per hero (and the number of movies they appeared in)
        var donut_group = chart.append("g").attr("class", "donut-group");
        var slice = donut_group.selectAll(".arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc)
            .style("fill", function (d) { return d.data.color; });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Create name labels //////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var hover_circle_group = chart.append("g").attr("class", "hover-circle-group");
        var name_group = chart.append("g").attr("class", "name-group");

        //Create a group per hero
        var names = name_group.selectAll(".name")
            .data(arcs)
            .enter().append("g")
            .attr("class", "name")
            .style("text-anchor", function (d) { return d.centerAngle > 0 & d.centerAngle < Math.PI ? "start" : "end";; })
            .style("font-family", "Anime Ace")
            
        //Add the big "main" name
        names.append("text")
            .attr("class", "name-label")
            .attr("id", function (d, i) { return "name-label-" + i; })
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                //If there is a last name, move the first a bit upward
                if(hero_total_data[i].real_name !== "") {
                    var finalAngle = d.centerAngle + (d.centerAngle > 0 & d.centerAngle < Math.PI ? -0.02 : 0.02);
                } else {
                    var finalAngle = d.centerAngle;
                }//else
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_name + ")"
                    + (finalAngle > 0 & finalAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("font-size", (16*size_factor)+"px")
            .text(function (d, i) { return hero_total_data[i].hero_name; });

        //Add the smaller last name (if available) below
        names.append("text")
            .attr("class", "last-name-label")
            .attr("id", function (d, i) { return "last-name-label-" + i; })
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                //If there is a last name, move the last a bit downward
                if(hero_total_data[i].real_name !== "") {
                    var finalAngle = d.centerAngle + (d.centerAngle > 0 & d.centerAngle < Math.PI ? 0.03 : -0.03);
                } else {
                    var finalAngle = d.centerAngle;
                }//else
                return "rotate(" + (finalAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_name + ")"
                    + (finalAngle > 0 & finalAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("font-size", (13*size_factor)+"px")
            .text(function (d, i) { return hero_total_data[i].real_name; });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////////// Create name dots ////////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var heroByName = [];
        //Color of the dot behind the name can be the type
        hero_total_data.forEach(function (d, i) {
            var text_width_first = document.getElementById('name-label-' + i).getComputedTextLength();
            var text_width_last = document.getElementById('last-name-label-' + i).getComputedTextLength();
            d.dot_name_rad = rad_name + Math.max(text_width_first,text_width_last) + 10;
            d.name_angle = (arcs[i].endAngle - arcs[i].startAngle) / 2 + arcs[i].startAngle;

            heroByName[d.hero] = d;
        })//forEach

        //Create hover circle that shows when you hover over a hero
        var rad_hover_circle = 35 * size_factor;
        var hover_circle = hover_circle_group.selectAll(".hover-circle")
            .data(hero_total_data)
            .enter().append("circle")
            .attr("class", "hover-circle")
            .attr("cx", function (d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function (d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            .attr("r", rad_hover_circle)
            .style("fill", function (d) { return d.color; })
            .style("fill-opacity", 0.3)
            .style("opacity", 0);

        //Add a circle at the end of each name of each hero
        var name_dot_group = chart.append("g").attr("class", "name-dot-group");
        var name_dot = name_dot_group.selectAll(".type-dot")
            .data(hero_total_data)
            .enter().append("circle")
            .attr("class", "type-dot")
            .attr("cx", function (d) { return d.dot_name_rad * Math.cos(d.name_angle - pi1_2); })
            .attr("cy", function (d) { return d.dot_name_rad * Math.sin(d.name_angle - pi1_2); })
            .attr("r", 6 * size_factor)
            .style("fill", function (d) { return d.color; })
            .style("stroke", "white")
            .style("stroke-width", 3 * size_factor);

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////////// Create inner relations /////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var pull_scale = d3.scaleLinear()
            .domain([2 * rad_relation, 0])
            .range([0.7, 2.3]);
        var color_relation = d3.scaleOrdinal()
            .domain(["family", "crush", "love", "friends", "master"]) //"teacher","ex-lovers","reincarnation","rival"
            .range(["#2C9AC6", "#FA88A8", "#E01A25", "#7EB852", "#F6B42B"])
            .unknown("#bbbbbb");
        var stroke_relation = d3.scaleOrdinal()
            .domain(["family", "crush", "love", "friends", "master"]) //"teacher","ex-lovers","reincarnation","rival"
            .range([4, 5, 8, 4, 5])
            .unknown(3);

        var relation_group = chart.append("g").attr("class", "relation-group");

        //Create the lines in between the heroes that have some sort of relation
        var relation_lines = relation_group.selectAll(".relation-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-path")
            .style("fill", "none")
            .style("stroke", function (d) { return color_relation(d.type); })
            .style("stroke-width", function (d) { return stroke_relation(d.type) * size_factor; })
            .style("stroke-linecap", "round")
            .style("mix-blend-mode", "multiply")
            .style("opacity", 0.7)
            .attr("d", create_relation_lines);

        function create_relation_lines(d) {
            var source_a = heroByName[d.source].name_angle,
                target_a = heroByName[d.target].name_angle;
            var x1 = rad_relation * Math.cos(source_a - pi1_2),
                y1 = rad_relation * Math.sin(source_a - pi1_2),
                x2 = rad_relation * Math.cos(target_a - pi1_2),
                y2 = rad_relation * Math.sin(target_a - pi1_2);
            var dx = x2 - x1,
                dy = y2 - y1,
                dr = Math.sqrt(dx * dx + dy * dy);
            var curve = dr * 1 / pull_scale(dr);

            //Get the angles to determine the optimum sweep flag
            var delta_angle = (target_a - source_a) / Math.PI;
            var sweep_flag = 0;
            if ((delta_angle > -1 && delta_angle <= 0) || (delta_angle > 1 && delta_angle <= 2))
                sweep_flag = 1;

            return "M" + x1 + "," + y1 + " A" + curve + "," + curve + " 0 0 " + sweep_flag + " " + x2 + "," + y2;
        }//function create_relation_lines

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////// Create inner relation hover areas ///////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var relation_hover_group = chart.append("g").attr("class", "relation-hover-group");
        var relation_hover_lines = relation_hover_group.selectAll(".relation-hover-path")
            .data(relation_data)
            .enter().append("path")
            .attr("class", "relation-hover-path")
            .style("fill", "none")
            .style("stroke", "white")
            .style("stroke-width", 16 * size_factor)
            .style("opacity", 0)
            // .style("pointer-events", "all")
            .attr("d", create_relation_lines)
            .on("mouseover", mouse_over_relation)
            .on("mouseout", mouse_out)

        //Call and create the textual part of the annotations
        var annotation_relation_group = chart.append("g").attr("class", "annotation-relation-group");

        function mouse_over_relation(d,i) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            clearTimeout(remove_text_timer);

            //Only show the hovered relationship
            relation_lines.filter(function(c,j) { return j !== i; })
                .style("opacity", 0.05);

            //Set up the annotation
            var annotations_relationship = [
                {
                    note: {
                        label: d.note,
                        title: capitalizeFirstLetter(d.type),
                        wrap: 150*size_factor,
                    },
                    relation_type: "family",
                    x: +d.x * size_factor,
                    y: +d.y * size_factor,
                    dx: 5 * size_factor,
                    dy: -5 * size_factor
                }
            ];

            //Set-up the annotation maker
            var makeAnnotationsRelationship = d3.annotation()
                // .editMode(true)
                .type(d3.annotationLabel)
                .annotations(annotations_relationship);
            annotation_relation_group.call(makeAnnotationsRelationship);

            //Update a few stylings
            annotation_relation_group.selectAll(".note-line, .connector")
                .style("stroke", "none");
            annotation_relation_group.select(".annotation-note-title")
                .style("fill", color_relation(d.type) === "#bbbbbb" ? "#9e9e9e" : color_relation(d.type));
            
        }//function mouse_over_relation

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create cover movie circle //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Add a circle at the center that will show the cover image on hover
        var cover_circle_group = chart.append("g").attr("class", "cover-circle-group");
        var cover_circle = cover_circle_group.append("circle")
            .attr("class", "cover-circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", rad_image)
            .style("fill", "none");

        ///////////////////////////////////////////////////////////////////////////
        ////////////////////// Create hidden name hover areas /////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var arc_hero_hover = d3.arc()
            .outerRadius(function(d,i) { return hero_total_data[i].dot_name_rad + rad_hover_circle; })
            .innerRadius(rad_donut_inner)

        //Create the donut slices per hero (and the number of movies they appeared in)
        var hero_hover_group = chart.append("g").attr("class", "hero-hover-group");
        var hero_hover = hero_hover_group.selectAll(".hero-hover-arc")
            .data(arcs)
            .enter().append("path")
            .attr("class", "hero-hover-arc")
            .attr("d", arc_hero_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", mouse_over_hero)
            .on("mouseout", mouse_out);

        function mouse_over_hero(d) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            //Show the chosen lines
            ctx.clearRect(-width/2, -height/2, width, height);
            ctx.globalAlpha = 0.8;
            create_lines("hero", hero_data.filter(function(c,j) {return c.hero === d.hero; }) );

            //Update label path
            line_label_path.attr("d", label_arc(heroByName[d.hero].name_angle));
            //Update the label text
            clearTimeout(remove_text_timer);
            var label_words = heroByName[d.hero].hero_name + " appears";
            line_label.text("movies that " + label_words + " in");

            //Highlight the movies this hero appears in
            var char_movies = hero_data
                .filter(function(c) { return c.hero === d.hero; })
                .map(function(c) { return c.movie; });
            var char_color = heroByName[d.hero].color;
            movie_hover_slice.filter(function(c,j) { return _.indexOf(char_movies,j+1) >= 0; })
                .style("fill", char_color)
                .style("stroke", char_color);
            movie_number.filter(function(c,j) { return _.indexOf(char_movies,j+1) >= 0; })
                .style("fill", "white");
            movie_dot.filter(function(c,j) { return _.indexOf(char_movies,j+1) >= 0; })
                .attr("r", movie_dot_rad * 1.5)
                .style("stroke-width", movie_dot_rad * 0.5 * 1.5)
                .style("fill", char_color);

            //Show the hero image in the center
            cover_image.attr("xlink:href", "img/" + d.hero.toLowerCase() + ".jpg")
            cover_circle.style("fill", "url(#cover-image)");

            //Show the hover circle
            hover_circle.filter(function(c) { return d.hero === c.hero; })
                .style("opacity", 1);

        }//function mouse_over_hero

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create movie donut chart //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Create groups in right order
        var movie_group = chart.append("g").attr("class", "movie-group");
        var donut_movie_group = movie_group.append("g").attr("class", "donut-movie-group");
        var movie_dot_group = movie_group.append("g").attr("class", "movie-dot-group");
        var donut_movie_hover_group = movie_group.append("g").attr("class", "donut-movie_hover-group");
        var movie_num_group = movie_group.append("g").attr("class", "movie-number-group");

        //Arc command for the movie number donut chart
        var arc_movie = d3.arc()
            .outerRadius(rad_movie_donut_outer)
            .innerRadius(rad_movie_donut_inner)
            .padAngle(0.01)
            .cornerRadius((rad_movie_donut_outer - rad_movie_donut_inner) / 2)

        //Create the donut slices per hero (and the number of movies they appeared in)
        var movie_slice = donut_movie_group.selectAll(".arc")
            .data(movie_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_movie)
            .style("fill", "none")
            .style("stroke", "#c4c4c4")
            .style("stroke-width", 1 * size_factor);
        //Create the donut slices per hero (and the number of movies they appeared in)
        var movie_hover_slice = donut_movie_hover_group.selectAll(".arc")
            .data(movie_location_data)
            .enter().append("path")
            .attr("class", "arc")
            .attr("d", arc_movie)
            .style("fill", "none")
            .style("stroke", "none")
            .style("stroke-width", 1.5 * size_factor);

        //The text is placed in the center of each donut slice
        var rad_movie_donut_half = ((rad_movie_donut_outer - rad_movie_donut_inner) / 2 + rad_movie_donut_inner);
                
        //Add movie number text
        var movie_number = movie_num_group.selectAll(".movie-number")
            .data(movie_location_data)
            .enter().append("text")
            .attr("class", "movie-number")
            .style("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("transform", function (d, i) {
                var angle = d.centerAngle * 180 / Math.PI - 90;
                return "rotate(" + angle + ")translate(" + rad_movie_donut_half + ")" +
                    // (d.centerAngle > 0 & d.centerAngle < Math.PI ? "" : "rotate(180)")
                    "rotate(" + -angle + ")";
            })
            .style("font-size", (9*size_factor) + "px")
            .text(function (d, i) { return i + 1; });

        //Add a circle at the inside of each movie slice
        var movie_dot_rad = 3.5 * size_factor;
        var movie_dot = movie_dot_group.selectAll(".movie-dot")
            .data(movie_location_data)
            .enter().append("circle")
            .attr("class", "movie-dot")
            .attr("cx", function (d) { return rad_dot_color * Math.cos(d.centerAngle - pi1_2); })
            .attr("cy", function (d) { return rad_dot_color * Math.sin(d.centerAngle - pi1_2); })
            .attr("r", movie_dot_rad)
            .style("fill", "#c4c4c4")
            .style("stroke", "white")
            .style("stroke-width", movie_dot_rad * 0.5);

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create phase dotted line ///////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        //Create groups in right order
        var donut_phase_group = chart.append("g").attr("class", "donut-phase-group");

        //Create the arcs data
        var phase_data = [
            { phase: 1, num_movies: 6, movie_start: 1, movie_end: 6, color: "#EB3223" },
            { phase: 2, num_movies: 6, movie_start: 7, movie_end: 12, color: "#363A80" },
            { phase: 3, num_movies:10, movie_start: 13, movie_end: 22, color: "#50B127" },
            { phase: 4, num_movies: 2, movie_start: 23, movie_end: 24, color: "#F6B42B" }
        ];
        phase_data = phase_data.filter(function(d) { return d.phase <= num_phase; });
        //Figure out the start and end angle
        phase_data.forEach(function (d, i) {
            d.startAngle = movie_location_data[d.movie_start - 1].startAngle,
            d.endAngle = movie_location_data[d.movie_end - 1].endAngle;
            d.centerAngle = (d.endAngle - d.startAngle) / 2 + d.startAngle;
        });

        var phase_slice = donut_phase_group.selectAll(".phase-arc")
            .data(phase_data)
            .enter().append("path")
            .attr("class", "phase-arc")
            .style("stroke", "#ffffff")
			.style("stroke", function(d,i) { return d.color; })
            .style("stroke-width", 3 * size_factor)
            .style("stroke-dasharray", "0," + (7 * size_factor))
            .attr("d", function(d,i) {
                var rad = rad_phase_inner,
                    xs = rad * Math.cos(d.startAngle - pi1_2),
                    ys = rad * Math.sin(d.startAngle - pi1_2),
                    xt = rad * Math.cos(d.endAngle - pi1_2),
                    yt = rad * Math.sin(d.endAngle - pi1_2)
                return "M" + xs + "," + ys + " A" + rad + "," + rad + " 0 0 1 " + xt + "," + yt;
            });
			
        ///////////////////////////////////////////////////////////////////////////
        ///////////////////// Create hidden movie hover areas ///////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var arc_movie_hover = d3.arc()
            .outerRadius(rad_movie_outer)
            .innerRadius(rad_movie_inner);

        //Create the donut slices per movie
        var movie_hover_group = chart.append("g").attr("class", "movie-hover-group");
        var movie_hover = movie_hover_group.selectAll(".movie-hover-arc")
            .data(movie_location_data)
            .enter().append("path")
            .attr("class", "movie-hover-arc")
            .attr("d", arc_movie_hover)
            .style("fill", "none")
            .style("pointer-events", "all")
            .on("mouseover", mouse_over_movie)
            .on("mouseout", mouse_out);

        //When you mouse over a movie arc
        function mouse_over_movie(d,i) {
            d3.event.stopPropagation();
            mouse_over_in_action = true;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.lineWidth = 4 * size_factor;
            ctx.globalAlpha = 1;
            create_lines("movie", hero_data.filter(function (c) { return c.movie === i+1; }));
            
            //Update label path
            line_label_path.attr("d", label_arc(d.centerAngle));
            //Update the label text
            clearTimeout(remove_text_timer);
            line_label.text("heroes that appear in " + movie_total_data[i].title );

            //Highlight the heroes that appear in this movie
            var char_movies = hero_data
                .filter(function(c) { return c.movie === i+1; })
                .map(function(c) { return c.hero; });

            names.filter(function(c) { return _.indexOf(char_movies, c.hero) < 0; })
                .style("opacity", 0.2);
            name_dot.filter(function(c) { return _.indexOf(char_movies, c.hero) < 0; })
                .style("opacity", 0.2);

            color_movie = phase_data[movie_total_data[i].phase-1].color;
            //Highlight the movie donut slice
            movie_hover_slice.filter(function (c, j) { return i === j; })
                .style("fill", color_movie)
                .style("stroke", color_movie);
            movie_number.filter(function (c, j) { return i === j; })
                .style("fill", "white");
            movie_dot.filter(function (c, j) { return i === j; })
                .attr("r", movie_dot_rad * 1.5)
                .style("stroke-width", movie_dot_rad * 0.5 * 1.5)
                .style("fill", color_movie);

            //Show the cover image in the center
            cover_image.attr("xlink:href", "img/" + (i+1) + ".jpg")
            cover_circle.style("fill", "url(#cover-image)");
        }//function mouse_over_movie

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// General mouse out function //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        container.on("mouseout", mouse_out);

        //When you mouse out of a movie or hero
        function mouse_out() {
            //Only run this if there was a mouseover before
            if(!mouse_over_in_action) return;
            mouse_over_in_action = false;

            ctx.clearRect(-width / 2, -height / 2, width, height);
            ctx.globalAlpha = cover_alpha;
            create_lines("hero", hero_data);

            //Update the label text
            line_label.text(default_label_text)
            remove_text_timer = setTimeout(function() { line_label.text("")}, 6000);

            //hero names back to normal
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //hero names back to normal
            names.style("opacity", null);
            name_dot.style("opacity", null);

            //movie donut back to normal
            movie_hover_slice.style("fill", "none").style("stroke", "none");
            movie_number.style("fill", null);
            movie_dot
                .attr("r", movie_dot_rad)
                .style("stroke-width", movie_dot_rad * 0.5)
                .style("fill", "#c4c4c4");

            //Remove cover image
            cover_circle.style("fill", "none");
            cover_image.attr("xlink:href", "img/white-square.jpg");

            //Hide the hover circle
            hover_circle.style("opacity", 0);
            //Hide the circle around the color movie group
            // color_hover_circle.style("opacity", 0);

            //Bring all relationships back
            relation_lines.style("opacity", 0.7);
            //Remove relationship annotation
            annotation_relation_group.selectAll(".annotation").remove();
        }//function mouse_out

        ///////////////////////////////////////////////////////////////////////////
        //////////////////////// Create title labels //////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var card_group = chart.append("g").attr("class", "card-group");

        //Create a group per hero
        var card_label = card_group.selectAll(".card-label")
            .data(movie_total_data)
            .enter().append("text")
            .attr("class", "card-label")
            .attr("dy", ".35em")
            // .attr("dx", "-10em")
            .each(function(d,i) {
                d.centerAngle = movie_location_data[d.movie-1].centerAngle;
            })
            .attr("transform", function (d, i) {
                return "rotate(" + (d.centerAngle * 180 / Math.PI - 90) + ")"
                    + "translate(" + rad_card_label + ")"
                    + (d.centerAngle > 0 & d.centerAngle < Math.PI ? "" : "rotate(180)");
            })
            .style("text-anchor", function (d) { return d.centerAngle > 0 & d.centerAngle < Math.PI ? "start" : "end"; })
            .style("font-size", (18 * size_factor) + "px")
            .text(function (d, i) { return d.title; });

        ///////////////////////////////////////////////////////////////////////////
        ///////////////////////// Create line title label /////////////////////////
        /////////////////////////////////////////////////////////////////////////// 

        var line_label_group = chart.append("g").attr("class", "line-label-group");

        //Define the arc on which to draw the label text
        function label_arc(angle) {
            var x1 = rad_line_label * Math.cos(angle + 0.01 - pi1_2),
                y1 = rad_line_label * Math.sin(angle + 0.01 - pi1_2);
            var x2 = rad_line_label * Math.cos(angle - 0.01 - pi1_2),
                y2 = rad_line_label * Math.sin(angle - 0.01 - pi1_2);
            if (angle / Math.PI > 0.5 && angle / Math.PI < 1.5) {
                return "M" + x1 + "," + y1 + " A" + rad_line_label + "," + rad_line_label + " 0 1 1 " + x2 + "," + y2;
            } else {
                return "M" + x2 + "," + y2 + " A" + rad_line_label + "," + rad_line_label + " 0 1 0 " + x1 + "," + y1;
            }//else
        }//function label_arc

        //Create the paths along which the pillar labels will run
        var line_label_path = line_label_group.append("path")
            .attr("class", "line-label-path")
            .attr("id", "line-label-path")
            .attr("d", label_arc(heroByName["c01"].name_angle))
            .style("fill", "none")
            .style("display", "none");

        //Create the label text
        var default_label_text = "";
        var line_label = line_label_group.append("text")
            .attr("class", "line-label")
            .attr("dy", "0.35em")
            .style("text-anchor", "middle")
            .style("font-size", (18 * size_factor) + "px")
            .append("textPath")
            .attr("xlink:href", "#line-label-path")
            .attr("startOffset", "50%")
            .text(default_label_text);

        ///////////////////////////////////////////////////////////////////////////
        //////////////////// Create hero & movie lines /////////////////////
        /////////////////////////////////////////////////////////////////////////// 
        
        //Line function to draw the lines from hero to movie on canvas
        var line = d3.lineRadial()
            .angle(function(d) { return d.angle; })
            .radius(function(d) { return d.radius; })
            .curve(d3.curveBasis)
            .context(ctx);
            
        //Draw the lines for the cover
        ctx.globalAlpha = cover_alpha;
        create_lines("hero", hero_data);

        function create_lines(type, data) {

            for (var i = 0; i < data.length; i++) {
                d = data[i];
                var line_data = [];

                var source_a = heroByName[d.hero].name_angle,
                    source_r = heroByName[d.hero].dot_name_rad
                var target_a = movie_location_data[d.movie - 1].centerAngle,
                    target_r = rad_dot_color;

                //Figure out some variable that will determine the path points to create
                if (target_a - source_a < -Math.PI) {
                    var side = "cw";
                    var da = 2 + (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else if (target_a - source_a < 0) {
                    var side = "ccw";
                    var da = (source_a - target_a) / Math.PI;
                    var angle_sign = -1;
                } else if (target_a - source_a < Math.PI) {
                    var side = "cw";
                    var da = (target_a - source_a) / Math.PI;
                    var angle_sign = 1;
                } else {
                    var side = "ccw";
                    var da = 2 - (target_a - source_a) / Math.PI;
                    var angle_sign = -1;
                }//else
                //console.log(side, da, angle_sign);


                //Calculate the radius of the middle arcing section of the line
                var range = type === "hero" ? [rad_line_max, rad_line_min] : [rad_line_min, rad_line_max];
                var scale_rad_curve = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var rad_curve_line = scale_rad_curve(da) * width;

                //Slightly offset the first point on the curve from the source
                var range = type === "hero" ? [0, 0.07] : [0, 0.01];
                var scale_angle_start_offset = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var start_angle = source_a + angle_sign * scale_angle_start_offset(da) * Math.PI;

                //Slightly offset the last point on the curve from the target
                var range = type === "hero" ? [0, 0.02] : [0, 0.07];
                var scale_angle_end_offset = d3.scaleLinear()
                    .domain([0, 1])
                    .range(range);
                var end_angle = target_a - angle_sign * scale_angle_end_offset(da) * Math.PI;

                if (target_a - source_a < -Math.PI) {
                    var da_inner = pi2 + (end_angle - start_angle);
                } else if (target_a - source_a < 0) {
                    var da_inner = (start_angle - end_angle);
                } else if (target_a - source_a < Math.PI) {
                    var da_inner = (end_angle - start_angle);
                } else if (target_a - source_a < 2 * Math.PI) {
                    var da_inner = pi2 - (end_angle - start_angle)
                }//else if

                //Attach first point to data
                line_data.push({
                    angle: source_a,
                    radius: source_r
                });

                //Attach first point of the curve section
                line_data.push({
                    angle: start_angle,
                    radius: rad_curve_line
                });

                //Create points in between for the curve line
                var step = 0.06;
                var n = Math.abs(Math.floor(da_inner / step));
                var curve_angle = start_angle;
                var sign = side === "cw" ? 1 : -1;
                if(n >= 1) {
                    for (var j = 0; j < n; j++) {
                        curve_angle += (sign * step) % pi2; 
                        line_data.push({
                            angle: curve_angle,
                            radius: rad_curve_line
                        });
                    }//for j
                }//if

                //Attach last point of the curve section
                line_data.push({
                    angle: end_angle,
                    radius: rad_curve_line
                });

                //Attach last point to data
                line_data.push({
                    angle: target_a,
                    radius: target_r
                });

                //Draw the path
                ctx.beginPath();
                line(line_data);
                ctx.strokeStyle = heroByName[d.hero].color;
                ctx.stroke(); 

            }//for

            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 3 * size_factor;

        }//function create_lines

    }//function draw

    // Retina non-blurry canvas
    function crispyCanvas(canvas, ctx, sf) {
        canvas
            .attr('width', sf * width)
            .attr('height', sf * height)
            .style('width', width + "px")
            .style('height', height + "px");
        ctx.scale(sf, sf);
    }//function crispyCanvas

    // //Dragging functions for final positioning adjustments
    // function dragstarted(d) {
    //     if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    //     d.fx = d.x;
    //     d.fy = d.y;
    // }//function dragstarted

    // function dragged(d) {
    //     d.fx = d3.event.x;
    //     d.fy = d3.event.y;
    // }//function dragged

    // function dragended(d) {
    //     if (!d3.event.active) simulation.alphaTarget(0);
    //     d.fx = null;
    //     d.fy = null;
    // }//function dragended

}//function create_MCU_chart

//////////////////////////////////////////////////////////////
////////////////////// Helper functions //////////////////////
//////////////////////////////////////////////////////////////

//Get a "random" number generator where you can fix the starting seed
//https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
var seed = 4;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}//function random

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}//function capitalizeFirstLetter
