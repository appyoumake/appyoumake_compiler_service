<?php
$app_path = "/home/utvikler/workspace/mlab.local.dev/mlab_elements/apps/e8481e22X9a4bX4d2eX9052X326ce77bf915/1/";
$md5sums = array();

$files = func_find( $app_path, "f", "*");
foreach ($files as $file) {
    $md5sums[] = md5_file($file);
}
sort($md5sums);
echo md5(implode("", $md5sums));



function func_find($path, $type = "", $wildcard = "", $exclude_files = "") {
        $dir_iterator = new \RecursiveDirectoryIterator($path);
        $iterator = new \RecursiveIteratorIterator($dir_iterator, \RecursiveIteratorIterator::SELF_FIRST);
        if ($wildcard == "") {
            $wildcard = "*";
        }
        $result = array();
        
        foreach ($iterator as $file) {
            if ( ($type == "") || ( $type == "f" && $file->isFile() ) || ( $type == "d" && $file->isDir() ) ) {
                if ( fnmatch($wildcard, $file->getPathname()) ) {
                    if ($exclude_files != "") {
                        $exclude = false;
                        foreach ($exclude_files as $exclude_file) {
                            if (fnmatch($exclude_file, $file->getPathname())) {
                                $exclude = true;
                                break;
                            }
                        }
                        if (!$exclude) {
                            $result[] = $file->getPathname();
                        }
                    } else {
                        $result[] = $file->getPathname();
                    }
                }
            }
        }
        
        return $result;
    }
