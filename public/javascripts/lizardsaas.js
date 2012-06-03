/* lizardsaas.js */

$(document).ready(function() {
  $('#login-with-dropbox').popover({
   'title': 'Why do I need a DropBox account?',
   'content': "We use DropBox for authenticating you, and for importing your files. When you sign in using your DropBox account, a new folder <em>Apps/LizardSaaS</em> appears in your DropBox."
  });
  

    var cloudmadeUrl = 'http://{s}.tile.cloudmade.com/BC9A493B41014CAABB98F0471D759707/997/256/{z}/{x}/{y}.png';
    var cloudmadeAttribution = 'Map data &copy; 2011 OpenStreetMap contributors, Imagery &copy; 2011 CloudMade';
    var cloudmade = new L.TileLayer(cloudmadeUrl, {maxZoom: 18, attribution: cloudmadeAttribution});


    var basiskaart = new L.TileLayer.WMS("http://test-geoserver1.lizard.net/geoserver/wms", {
        layers: 'basiskaart',
        format: 'image/png',
        transparent: true,
        attribution: "Nelen &amp; Schuurmans &copy; 2012"
    });

    var ahn25m = new L.TileLayer.WMS("http://geodata.nationaalgeoregister.nl/ahn25m/wms", {
        layers: 'ahn25m',
        format: 'image/png',
        transparent: true,
        attribution: "Nationaal Georegister &copy; 2012"
    });
    
    var natura2000 = new L.TileLayer.WMS("http://geodata.nationaalgeoregister.nl/natura2000/wms", {
        layers: 'natura2000',
        format: 'image/png',
        transparent: true,
        attribution: "Nationaal Georegister &copy; 2012"
    });
        
        

        
    var baseMaps = {
        "Basiskaart": basiskaart
    };

    var overlayMaps = {
        "AHN": ahn25m,
        "Natura": natura2000  
    };
    layersControl = new L.Control.Layers(baseMaps, overlayMaps);
    
    var map = new L.Map('map', {
        layers: [basiskaart]
    });
	map.addControl(layersControl);
    // ahn25m._image.style.opacity = 0.5;           
    // map.addLayer(nexrad);
    // map.addLayer(cloudmade);
    map.on('locationerror', function(e) {
      alert(e.message);
      return map.fitWorld();
    });
    return map.locateAndSetView(7);







});


