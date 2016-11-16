/*******************************************************************************************************************************
@copyright Copyright (c) 2013-2016, Norwegian Defence Research Establishment (FFI) - All Rights Reserved

@license Proprietary and confidential

@author Arild Bergh/Sinett 3.0 programme (firstname.lastname@ffi.no) 

Unauthorized copying of this file, via any medium is strictly prohibited 

For the full copyright and license information, please view the LICENSE_MLAB file that was distributed with this source code.
*******************************************************************************************************************************/
/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 
        var orientations = ["port", "land"]
<platform name="android">
    <!-- you can use any density that exists in the Android project -->
    <splash src="res/screen/android/splash-land-hdpi.png" density="land-hdpi"/>
    <splash src="res/screen/android/splash-land-ldpi.png" density="land-ldpi"/>
    <splash src="res/screen/android/splash-land-mdpi.png" density="land-mdpi"/>
    <splash src="res/screen/android/splash-land-xhdpi.png" density="land-xhdpi"/>

    <splash src="res/screen/android/splash-port-hdpi.png" density="port-hdpi"/>
    <splash src="res/screen/android/splash-port-ldpi.png" density="port-ldpi"/>
    <splash src="res/screen/android/splash-port-mdpi.png" density="port-mdpi"/>
    <splash src="res/screen/android/splash-port-xhdpi.png" density="port-xhdpi"/>
</platform>
*/
function preBuild (app, config, platform, code, args, app_config_data) {
    //app_config_data = JS object representing the config.xml file
    var orientations = ["port", "land"];
    var resolutions = ["hdpi", "ldpi", "mdpi", "xhdpi"];
    var platform_config = false;
    
//if no platform specific settings defined in config.xml, a it here, we also add the splash setting as wee will populate this with the splash screen details
    if (typeof app_config_data["platform"] == "undefined") {
        app_config_data["platform"] = {"$": {"name": platform}, "splash": []};
    } else {
        for (p in app_config_data["platform"]) {
            if (app_config_data.platform[p].$.name == platform) {
                platform_config = app_config_data.platform[p];
                break;
            }
        }
        if (!platform_config) {

        }
    }
    
    
    if (typeof platform_config["splash"] == "undefined") {
        platform_config["splash"] = [];
    }
    
    for (var o in orientations) {
        for (var r in resolutions) {
           platform_config["splash"]
        }
    }
    
}