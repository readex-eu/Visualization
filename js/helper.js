var getScenariobyID = function( id, scenarios )
{
    return scenarios.find(function(d) {
        return d.id === id;
    });
};

var getScenarioIDbyCallpath = function( cpath, rtsCallPath )
{
    return rtsCallPath.find(function(d) {
        return d.callPath === cpath;
    }).scenario;
};

var getGroupbyScenario = function ( sc_id, scenarioArr)
{
    return scenarioArr.find(function(d) {
        return d.name === sc_id;
    });
};

var getExecTimetbyRTS = function (cpath, rtsXMLData)
{
    //calculate the weight of a phase rts by aggregating the execution time of all the rts's under the phase rts.
    var phase_weight = 0;
    rtsXMLData.forEach(function(d){
        phase_weight += parseFloat(d.weight);
    });
    console.log("phase weight" + phase_weight);
    var obj = rtsXMLData.find(function(d) {
    	    //console.log(d.callpath + " \n" + cpath.toString());
    	    //console.log("\n"+ d.callpath === cpath.toString());
        return d.callpath === cpath.toString();
    });
    if (obj === undefined){
    	    //console.log("obj callpath " + cpath.toString() + " not found; assuming to be phase\n")
        return phase_weight;// phase execution_time
    }
    else return obj.weight;

};

var getRTSObjbyname = function ( cpath, rtsCallPaths )
{
    return rtsCallPaths.find(function(d) {
        return d.name === cpath;
    });
};
/**
 * @description scenario_weight = sum of all rts weights belongs to it
 * @param sc_id
 * @param rtsCallPaths
 */
var computeScenarioWeight = function (sc_id, rtsCallPaths, rtsXMLData)
{
    var sc_weight = 0;
    rtsCallPaths.forEach(function(d){
        var weight = d.scenario === sc_id ? getExecTimetbyRTS(d.callPath, rtsXMLData) : 1; // phase execution_time
        //console.log(d.scenario + ":" + sc_id + ":" + d.callPath +":" + weight);
        sc_weight += parseFloat(weight);
    });
    return sc_weight;
};

var getRTSCallPathsbyScenario = function( sc_name, rtsCallPaths )
{
    var cpaths =[];
    rtsCallPaths.forEach( function (d) {
        d.scenario === sc_name ? cpaths.push( {name: d.callPath, exec_t: d.exec_t, label: d.label} ) : {};
    });
    return cpaths;
};

var getIndex = function( name, nodes)
{
    return nodes.map(function (d1) {
        return d1.name;
    }).indexOf(name);
};

var constructRTSCallpaths = function( rts_s )
{
    var callPaths = [];
    rts_s.forEach(function (d) {
        var callPath = d.callpath;
        var cpath_str = "";
        callPath.forEach(function (d1) {
          cpath_str +=  "/"+ d1.region.name;
          if (d1.identifiers){
            d1.identifiers.forEach(function(identifier){
              cpath_str+="/"+identifier.name+"="+identifier.value;
            })
          };
        });

        var i = { region: d.region, scenario:d.scenario, callPath: cpath_str};
        callPaths.push(i);
    });

    return callPaths;
};

var constructRTSs = function(rts_s , rtsArray)
{
    var r_cpaths = constructRTSCallpaths(rts_s);
    r_cpaths.forEach( function (d, i) {
        var rts = getRTSObjbyname( d.callPath, rtsArray );
        r_cpaths[i] = {callPath: d.callPath, region: d.region, scenario: d.scenario, exec_t: rts.exec_t, label: rts.label};
    });
    return r_cpaths;
};


var computeSimilartyDistance = function ( from, to, scenarios ) {
    var distance, max_cpu = 0, max_uncore = 0, max_threads = 0;

    //compute max of cpu and uncore frequency
    scenarios.forEach( function (d) {
        var threads = d.configuration[0].value; // THREADS
        var uncore  = d.configuration[1].value; // UNCORE
        var cpu     = d.configuration[2].value; // CPU
        max_uncore = uncore >= max_uncore ? uncore : max_uncore;
        max_cpu = cpu >= max_cpu ? cpu : max_cpu;
        max_threads = threads >= max_threads ? threads : max_threads;

    });
    var from_scen = getScenariobyID( from, scenarios );
    var to_scen = getScenariobyID( to,scenarios );
    var threads1     = (from_scen.configuration[0].value / max_threads)*100; //THREADS
    var uncore_freq1 = (from_scen.configuration[1].value / max_uncore)*100; //UNCORE_FREQ
    var cpu_freq1    = (from_scen.configuration[2].value / max_cpu)*100; //CPU_FREQ
    var uncore_freq2 = (to_scen.configuration[1].value / max_uncore)*100;//UNCORE_FREQ
    var threads2     = (to_scen.configuration[0].value / max_threads)*100; //THREADS
    var cpu_freq2    = (to_scen.configuration[2].value/ max_cpu)*100; //CPU_FREQ

    //sqrt(core_from-core_to)*(core_from-core_to) + (uncore_from-uncore_to)*(uncore_from-uncore_to)
    if( cpu_freq1 !== undefined && uncore_freq1 !== undefined && threads1 !== undefined )
        distance =  Math.sqrt( (cpu_freq1 - cpu_freq2)*(cpu_freq1 - cpu_freq2) + (uncore_freq1 - uncore_freq2)*(uncore_freq1 - uncore_freq2) + (threads1 - threads2)*(threads1 - threads2) );
    else if( cpu_freq1 === undefined && uncore_freq1 !== undefined && threads1 !== undefined )
        distance =  Math.sqrt( (uncore_freq1 - uncore_freq2)*(uncore_freq1 - uncore_freq2) + (threads1 - threads2)*(threads1 - threads2) );
    else if( cpu_freq1 !== undefined && uncore_freq1 === undefined && threads1 !== undefined )
        distance =  Math.sqrt( (cpu_freq1 - cpu_freq2)*(cpu_freq1 - cpu_freq2) + (threads1 - threads2)*(threads1 - threads2) );
    else if( cpu_freq1 !== undefined && uncore_freq1 !== undefined && threads1 === undefined )
        distance =  Math.sqrt( (cpu_freq1 - cpu_freq2)*(cpu_freq1 - cpu_freq2) );
    else
        distance = 100; // default value
    return distance;
};

var constructData = function ( rts_s, rtsXMLData, scenarios ) {

    var group_id = 1, rtsCallPaths, indx;
    var nodes = [], rtsArr = [], scArr = [], links = [] ;

    //construct nodes of rts's second
    rtsCallPaths = constructRTSCallpaths(rts_s);

    //construct nodes of scenarions first
    scenarios.forEach (function(d){
        var sc_weight = computeScenarioWeight(d.id, rtsCallPaths, rtsXMLData);
        var sc_it = { name: d.id, exec_t: sc_weight, group : group_id++, label: 0 };
        scArr.push (sc_it);
    });

    rtsCallPaths.forEach(function (d,i) {
        var gr_id = getGroupbyScenario(d.scenario, scArr).group;
        var weight = getExecTimetbyRTS(d.callPath, rtsXMLData);
        var rts_i = {name: d.callPath, exec_t: parseFloat(weight), group: gr_id, label: ++i};
        rtsArr.push(rts_i);
    });

    nodes = scArr.concat(rtsArr);
    var cpyArr = scArr.slice(0);
    //construct links between scenarios
    scArr.forEach(function(d){
        var src_name = d.name;
        cpyArr.forEach(function(d1){
            var target_name = d1.name;
            if( src_name !== target_name )
            {
                var dist = computeSimilartyDistance( src_name, target_name, scenarios );
                var pos_src = getIndex( src_name, nodes );
                var pos_target = getIndex( target_name, nodes );
                var l_i = { source: pos_src, target: pos_target, dist: dist ===0 ? 20: dist, strength: dist ===0 ? 99: (1/dist)*100}; // if dist = 0, the scenarios are most similar. In this case, dist = 20 and strength = 99(max), otherwise, strength = 1/dist
                links.push( l_i );
            }
        });
        indx = getIndex( src_name, cpyArr );
        cpyArr.splice(indx,1);
    });

    //construct links between sscenarios and rts's
    rtsCallPaths.forEach(function (d) {
        var pos_sc = getIndex( d.scenario, nodes );
        var pos_cPath = getIndex( d.callPath, nodes );
        var l_i = { source: pos_sc, target: pos_cPath, dist: 50, strength: 1};
        links.push( l_i );
    });

    return { nodes: nodes, links: links, rtsArray: rtsArr};
};
