#!/bin/sh
# Copy shared scheme file into directory
mkdir $1/$2.xcodeproj/xcshareddata
mkdir $1/$2.xcodeproj/xcshareddata/xcschemes
cp data/MLAB.xcscheme $1/$2.xcodeproj/xcshareddata/xcschemes/.
# Use sed to replace app name in scheme file
sed -i '' "s/%app_name%/$2/g" $2.xcodeproj/xcshareddata/xcschemes/MLAB.xcscheme

# CD into directory
cd $1
# Move files from Cordova to our build directory
cp -r CordovaLib/build/* build/.

# Build and export
xcodebuild clean -configuration Release -alltargets
xcodebuild -scheme MLAB archive -archivePath build/$2
xcodebuild -exportArchive -exportFormat ipa -archivePath "build/$2.xcarchive" -exportPath "$2.ipa" -exportProvisioningProfile "$3"
