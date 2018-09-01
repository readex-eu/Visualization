var forcedLayoutView = function () {
    var width = 700,     // svg width
        height = 600,     // svg height
        dr = 4,      // default point radius
        off = 15,    // cluster hull offset
        expand = {}, // expanded clusters
        data, net, force, hullg, hull, linkg, link, nodeg, node, RTSXMLdata, regions, rts_s, scenarios, rtsCallPaths, rtsInfos;

    var chart = function (container) {

        var curve = d3.svg.line()
            .interpolate("cardinal-closed")
            .tension(.85);

        var fill = d3.scale.category20();

        function noop() { return false; }

        function nodeid(n) {
            return n.size ? "_g_"+n.group : n.name;
        }

        function linkid(l) {
            var u = nodeid(l.source),
                v = nodeid(l.target);
            return u<v ? u+"|"+v : v+"|"+u;
        }

        function getGroup(n) { return n.group; }

    // constructs the network to visualize network(data, net, getGroup, expand);
        function network(data, prev, index, expand) {
            expand = expand || {};
            var gm = {},    // group map
                nm = {},    // node map
                lm = {},    // link map
                gn = {},    // previous group nodes
                gc = {},    // previous group centroids
                nodes = [], // output nodes
                links = []; // output links

            // process previous nodes for reuse or centroid calculation
            if (prev) {
                prev.nodes.forEach(function(n) {
                    var i = index(n), o;
                    if (n.size > 0) {
                        gn[i] = n;
                        n.size = 0;
                    } else {
                        o = gc[i] || (gc[i] = {x:0,y:0,count:0});
                        o.x += n.x;
                        o.y += n.y;
                        o.count += 1;
                    }
                });
            }

            // determine nodes
            for (var k=0; k<data.nodes.length; ++k) {
                var n = data.nodes[k],
                    i = index(n), //group id
                    l = gm[i] || (gm[i]=gn[i]) || (gm[i]={group:i, size:0, exec_t:n.exec_t, nodes:[]});

                if (expand[i]) {
                    // the node should be directly visible
                    nm[n.name] = nodes.length;
                    nodes.push(n);
                    if (gn[i]) {
                        // place new nodes at cluster location (plus jitter)
                        n.x = gn[i].x + Math.random();
                        n.y = gn[i].y + Math.random();
                    }
                } else {
                    // the node is part of a collapsed cluster
                    if (l.size == 0) {
                        // if new cluster, add to set and position at centroid of leaf nodes
                        nm[i] = nodes.length;
                        nodes.push(l);
                        if (gc[i]) {
                            l.x = gc[i].x / gc[i].count;
                            l.y = gc[i].y / gc[i].count;
                        }
                    }
                    l.nodes.push(n);
                }
                // always count group size as we also use it to tweak the force graph strengths/distances
                l.size += 1;
                //l.exec_t += n.exec_t;
                n.group_data = l;
            }

            for (i in gm) { gm[i].link_count = 0; }

            //scale the weight range [1,10] domain[min.max]
            var weigh_arr = [];
            for( i in nodes ){ weigh_arr.push(nodes[i].exec_t); }

            //console.log(weigh_arr);
            var max = d3.max(weigh_arr);
            var min = d3.min(weigh_arr);
            var scale = d3.scale.linear().domain([min, max]).range([6, 15]);
            for ( i in nodes )
                nodes[i].exec_t =  scale(weigh_arr[i]);

            // determine links
            for (k=0; k<data.links.length; ++k) {
                var e = data.links[k],
                    u = index(e.source),
                    v = index(e.target)
                    d = e.dist
                    s = e.strength;
                if (u != v) {
                    gm[u].link_count++;
                    gm[v].link_count++;
                }
                u = expand[u] ? nm[e.source.name] : nm[u];
                v = expand[v] ? nm[e.target.name] : nm[v];

                var i = (u<v ? u+"|"+v : v+"|"+u),
                    l = lm[i] || (lm[i] = {source:u, target:v, size:0, dist:d, strength:s});
                l.size += 1;
            }
            for (i in lm) { links.push(lm[i]); }

            //scale the strength/stroke-width range [0.1,1] domain[min.max]
            var strength_arr = [];
            for (i in links) { strength_arr.push(links[i].strength); }

            //console.log(weigh_arr);
            var max_s = d3.max(strength_arr);
            var min_s = d3.min(strength_arr);
            var scale_s = d3.scale.linear().domain([min_s, max_s]).range([0.1, 1]);

            for ( i in links )
                links[i].strength =  scale_s(strength_arr[i]);

            return {nodes: nodes, links: links};
        }

        function convexHulls(nodes, index, offset) {
            var hulls = {};

            // create point sets
            for (var k=0; k<nodes.length; ++k) {
                var n = nodes[k];
                if (n.size) continue;
                var i = index(n),
                    l = hulls[i] || (hulls[i] = []);
                l.push([n.x-offset, n.y-offset]);
                l.push([n.x-offset, n.y+offset]);
                l.push([n.x+offset, n.y-offset]);
                l.push([n.x+offset, n.y+offset]);
            }

            // create convex hulls
            var hullset = [];
            for (i in hulls) {
                hullset.push({group: i, path: d3.geom.hull(hulls[i])});
            }

            return hullset;
        }

        function drawCluster(d) {
            return curve(d.path);
        }

    // --------------------------------------------------------

        var body = d3.select("body");

        var vis = body.append("svg")
            .attr("width", width)
            .attr("height", height);

        var json = d3.entries(data.TMData);

        //get clusters
        clusters = json[1].value;

        //get regions
        regions = json[2].value;

        //get rtss
        rts_s = json[3].value;

        //get scenarios
        scenarios = json[4].value;

        //read data of rts.xml file
        RTSXMLdata = data.RTSXML;

        //console.log(RTSXMLdata);

        data = constructData( rts_s, RTSXMLdata, scenarios );

        rtsInfos = data.rtsArray;
        rtsCallPaths = constructRTSs(rts_s , rtsInfos);

        for (var i=0; i<data.links.length; ++i) {
            o = data.links[i];
            o.source = data.nodes[o.source];
            o.target = data.nodes[o.target];
        }

        hullg = vis.append("g");
        linkg = vis.append("g");
        nodeg = vis.append("g");

        init();

        vis.attr("opacity", 1e-6)
            .transition()
            .duration(1000)
            .attr("opacity", 1);

        function init() {
            if (force) force.stop();

            net = network(data, net, getGroup, expand);

            //info box
            var tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0);
            tooltip.append('div')
                .attr('class', 'label')
                .style('font-weight','bold')
                .style('display', 'inline');

            tooltip.append('hr');
            tooltip.append('div')
                   .attr('class', 'config')
                   .style('font-weight','bold');
            tooltip.append('br');
            var t_params = scenarios[0].configuration; //get the names of tuning params for the first scenario
            t_params.forEach( function (d) {
                tooltip.append('div')
                       .attr('class', d.id);

            });
            tooltip.append('br');
            tooltip.append('div')
                .attr('class', 'rts')
                .style('font-weight','bold');
            tooltip.append('br');

            tooltip.append('div')
                .attr('class', 'rts_s');

            force = d3.layout.force()
                .nodes(net.nodes)
                .links(net.links)
                .size([width, height])
                .linkDistance(function(l, i) {
                    return l.dist;
                })
                .linkStrength(function(l, i) { // rigidity of the link
                    return l.strength;
                })
                .gravity(0.2)   // gravity+charge tweaked to ensure good 'grouped' view (e.g. green group not smack between blue&orange, ...
                .charge(-1000)    // ... charge is important to turn single-linked groups to the outside
                .friction(0.5)   // friction adjusted to get dampened display: less bouncy bouncy ball [Swedish Chef, anyone?]
                .start();

            hullg.selectAll("path.hull").remove();
            hull = hullg.selectAll("path.hull")
                .data(convexHulls(net.nodes, getGroup, off))
                .enter().append("path")
                .attr("class", "hull")
                .attr("d", drawCluster)
                .style("fill", function(d) { return fill(d.group); })
                .on("click", function(d) {
                    //console.log("hull click", d, arguments, this, expand[d.group]);
                    expand[d.group] = false; init();
                });

            link = linkg.selectAll("line.link").data(net.links, linkid);
            link.exit().remove();
            link.enter().append("line")
                .attr("class", "link")
                .attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; })
                .style("stroke-width", function(d) {
                    return (1/d.dist)*100;
                });

            node = nodeg.selectAll("circle.node").data(net.nodes, nodeid);
            node.exit().remove();
            node.enter().append("circle")
            // if (d.size) -- d.size > 0 when d is a group node.
                .attr("class", function(d) { return "node" + (d.size?"":" leaf"); })
                .attr("r", function(d) {
                    return d.exec_t;
                    })
                .attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; })
                .style("stroke-width", function (d) {
                    if (d.exec_t ===15) //check if it is the phase node. [0,100]===[6,15]
                        return 5;
                    return 2.5;
                })
                .style("fill", function(d) { return fill(d.group); })
                .on("click", function(d) {
                    mouseout(d);
                    console.log("node click", d, arguments, this, expand[d.group]);
                    expand[d.group] = !expand[d.group];
                    init();
                })
                .on("mouseover",mouseover)
                .on("mouseout", mouseout);
            /*node.append("text")
                .attr("class", function(d) { return "text" + (d.size?"":" leaf"); })
                .attr("x", function (d) { return d.x+100; })
                .attr("y", function (d){ return d.y; })
                .attr("text-anchor", "middle")
                .style("fill", 'white')
                .style("font", '20px')
                .text(function (d,i) {
                    //console.log(d);
                    //console.log(i);
                    //console.log(d.label);
                    return d.label;
                });*/

            node.call(force.drag);

            force.on("tick", function() {
                tooltip.style('opacity', 0);
                if (!hull.empty()) {
                    hull.data(convexHulls(net.nodes, getGroup, off))
                        .attr("d", drawCluster);
                }

                link.attr("x1", function(d) { return d.source.x; })
                    .attr("y1", function(d) { return d.source.y; })
                    .attr("x2", function(d) { return d.target.x; })
                    .attr("y2", function(d) { return d.target.y; });

                node.attr("cx", function(d) { return d.x; })
                    .attr("cy", function(d) { return d.y; });
            });
            function mouseover(d) {
                var g_nodes, sc_name, size;
                if ( d.nodes !== undefined )
                    sc_name = d.nodes[0].name;
                else
                {
                    var scObj = data.nodes.find( function (d1) {
                        return d1.label === 0 && d1.name === d.name;
                    });
                    var rtsObj = data.nodes.find( function (d1) {
                        return d1.label !== 0 && d1.name === d.name;
                    });
                    if(scObj !== undefined)
                        sc_name = scObj.name;
                    else if(rtsObj !== undefined)
                        sc_name = getScenarioIDbyCallpath( rtsObj.name, rtsCallPaths );
                }
                g_nodes = getRTSCallPathsbyScenario( sc_name, rtsCallPaths );
                var configs = scenarios.find(function (d1) {
                     return d1.id === sc_name;
                }).configuration;

                tooltip.select('.label')
                       .html("SCENARIO ID: "+  sc_name);
                tooltip.select('.config')
                       .html("Configurations:");
                configs.forEach(function (d2) {
                    tooltip.select('.'+d2.id)
                           .html(d2.id +" "+ d2.value);
                });
                tooltip.select('.rts')
                       .html('Runtime Situations:' );
                size = g_nodes.length;
                var str='';
                for( var n = 0; n < size; n++ )
                {
                    str += g_nodes[n].label + ': '+ g_nodes[n].name.replace(/\//gi,"/ ") + '<br>' + 'weight (%phase): '+ g_nodes[n].exec_t.toPrecision(5) + '<br>' + '<br>' ;
                }
                tooltip.select('.rts_s')
                    .html(str);
                tooltip.style('opacity', 0.9)
                       .style("left", (width+10) + "px")
                       .style("top", (height-500) + "px");

            }
            function mouseout(d) {
                tooltip.style('opacity', 0);
            }
        } // init
    }
    chart.data = function (value) {
        if (!arguments.length) return data;
        data = value;
        return chart;
    }

    return chart;

};
