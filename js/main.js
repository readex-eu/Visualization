function onChange(){
    var x = document.getElementById("TMfiles");
    var txt = "", tm, rts;
    if ('files' in x) {
        if (x.files.length == 0) {
            txt = "Select tuning_model.json and rts.xml files only";
        }
        else if(x.files.length > 2){
            txt += "Only allowed to provide two files";
        }
        else {
            for (var i = 0; i < x.files.length; i++) {
                txt += "<br><strong>" + (i+1) + ". file</strong><br>";
                var file = x.files[i];
                if ('name' in file) {
                    //console.log(file);
                    /*check .json and .xml extension*/
                    var ext =  file.name.split('.').pop();
                    txt += "name: " + file.name + "<br>";
                    if (ext === "xml")
                        rts = file.path;
                    else if(ext === "json")
                        tm = file.path;
                }
                /*if ('size' in file) {
                    txt += "size: " + file.size + " bytes <br>";
                }*/
            }
            d3.json(tm, function(json) {
                var RTSXMLdata;
                //parse the rts.xml file
                d3.xml(rts, function(xmlObj) {
                    var rtsData = xml2json(xmlObj);
                    console.log("about to parse rts data\n");
                    var rts_json = JSON.parse( rtsData.replace('undefined','') );
                    RTSXMLdata = rts_json.RTS.entry;
                    var data = {TMData: json, RTSXML: RTSXMLdata};
                    console.log("parsed input\n");
                    var view = forcedLayoutView().data(data);
                    var ContainerId = 'menuContainer';
                    d3.select('body')
                        .append('div')
                        .attr('id', ContainerId)
                        .call(view);
                });
            });
        }
    }
    else {
        if (x.value == "") {
            txt += "Select tuning_model.json and rts.xml files only";
        } else {
            txt += "The files property is not supported by your browser!";
            txt  += "<br>The path of the selected file: " + x.value; // If the browser does not support the files property, it will return the path of the selected file instead.
        }
    }
    document.getElementById("filename").innerHTML = txt;
}
