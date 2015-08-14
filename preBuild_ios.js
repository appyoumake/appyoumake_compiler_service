/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function postBuild (app, config, platform, code, args) {
    args.push("--device");
}