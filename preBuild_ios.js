/*******************************************************************************************************************************
@copyright Copyright (c) 2013-2016, Norwegian Defence Research Establishment (FFI) 

@license Licensed under the Apache License, Version 2.0 (For the full copyright and license information, please view the /LICENSE_APPYOUMAKE.md file that was distributed with this source code)

@author Arild Bergh/Sinett 3.0 programme (firstname.lastname@ffi.no) 
*******************************************************************************************************************************/
/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function preBuild (app, config, platform, code, args) {
    args.push("--device");
}