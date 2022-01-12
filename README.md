# Serverless Lambda for Image Resizing

This lambda crops and adds watermark text to each image that falls into a specific bucket, then uploads the new image to a different bucket.

## Usage

Make sure you have rimraf installed globally on your machine

```
$ npm i rimraf -g
```

### Deployment

```
$ serverless deploy
```
