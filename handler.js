// dependencies
const AWS = require('aws-sdk');
const sharp = require('sharp');
const Jimp = require('jimp/dist');
const sizeOf = require('image-size');

// get reference to S3 client
const s3 = new AWS.S3();

async function hello(event, context, callback) {
    // Read options from the event parameter.
    const srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    const dstBucket = srcBucket + '.served';
    const dstKey = srcKey;

    // Infer the image type from the file suffix.
    const typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        console.log("Could not determine the image type.");
        return;
    }

    // Check that the image type is supported
    const imageType = typeMatch[1].toLowerCase();
    if (imageType != "jpg" && imageType != "png") {
        console.log(`Unsupported image type: ${imageType}`);
        return;
    }

    // Download the image from the S3 source bucket.
    let originalImage;
    try {
        const params = {
            Bucket: srcBucket,
            Key: srcKey
        };
        originalImage = await s3.getObject(params).promise();
        originalImage = originalImage.Body;
    } catch (error) {
        console.log(error);
        return;
    }

    // Use the sharp module to resize the image and save in a buffer.
    try {
        let sizes = [{vx: 360, vy: 360, t: 's'}, {vx:500, vy:500, t:'m'}, {vx:800, vy:800, t:'l'}, {vx:null, vy:null, t:'x'}];
        for (let ob of sizes) {
            let sizex = ob.vx;
            let sizey = ob.vy;

            const dimensions = sizeOf(originalImage);

            if(!sizex && !sizey){
                sizex = dimensions.width;
                sizey = dimensions.height;
            }


            if (dimensions.height > dimensions.width) {
                originalImage = await sharp(originalImage).extract({ width: 1260, height: 2048, left: 0, top: 0 }).toBuffer();
            } else {
                originalImage = await sharp(originalImage).extract({ width: 1952, height: 1260, left: 0, top: 0 }).toBuffer();
            }

            const resized = await sharp(originalImage).resize(sizex, sizey).toBuffer();

            let font = await Jimp.loadFont(sizex === 360 ? Jimp.FONT_SANS_16_WHITE : Jimp.FONT_SANS_32_WHITE);
            const fontCanvas = await Jimp.create(sizey, sizex);
            const destImage = await Jimp.read(resized);

            let x;
            let y;
            if (sizex === 800) {
                x = 220;
                y = 750;
            } else if (sizex === 500) {
                x = 75;
                y = 452;
            } else if (sizex === 360) {
                x = 75;
                y = 330;
            } else if (sizex < sizey) {
                x = 600;
                y = sizey/2+150;
                font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
            } else if(sizex > sizey){
                x = 200;
                y = sizex-96;
                font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
            }

            fontCanvas.print(font, x, y, 'TREVODOURADO.NET').rotate(90);
            const destWithText = await destImage.blit(fontCanvas, 0, 0).getBufferAsync(imageType === 'jpg' ? Jimp.MIME_JPEG : Jimp.MIME_PNG);

            const finalImage = await sharp(destWithText).resize(sizex, sizey).toBuffer();

            const destparams = {
                Bucket: dstBucket,
                Key: imageType === 'jpg' ? dstKey.replace('.jpg', '_'+ob.t+'.jpg') : dstKey.replace('.png', '_'+ob.t+'.png'),
                Body: finalImage,
                ContentType: "image",
            };

            await s3.putObject(destparams).promise();
        }
        await s3.deleteObject({  Bucket: srcBucket, Key: srcKey }).promise();
    } catch (error) {
        console.log(error);
        return;
    }
};
export { hello };