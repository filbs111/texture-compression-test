//1 draw a quad to the screen
//2 use a texture. load or procedural. procedural gradient should be useful
//3 attempt generating dxt1. min=max colour and zeros for per pixel part should suffice.
//4 pull out correct min, max colours, set bits correctly
//5 benchmark it. have a go at some optimisation
//6 gpu implementation!

var shaderPrograms={};
var fsBuffers={};

var fsDeep = 1; //unused, but keep 3vec vertices for consistency with other projects.
var fsData = {
	vertices:[
		-1,-1,-fsDeep,
		-1,1,-fsDeep,
		1,-1,-fsDeep,
		1,1,-fsDeep
	],
	indices:[
		//0,1,2,
		0,2,1,
		//1,3,2
		1,2,3
	]
}


function init(){
    canvas = document.getElementById("glcanvas");

    initGL();
    console.log({gl});
    initShaders();
    initTexture();
    initBuffers();
    getLocationsForShaders();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);   //maybe unnecessary
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor.apply(gl,[0,1,0,1]);  //green
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawStuff();
    console.log("drew stuff");
}

function initShaders(){
    shaderPrograms.flatcolor = loadShader("shader-basic-vs", "shader-flatcolor-fs");
    shaderPrograms.tex = loadShader("shader-basic-vs", "shader-tex-fs");
}

function initBuffers(){
    loadBufferData(fsBuffers, fsData);

    function loadBufferData(bufferObj, sourceData){
		bufferObj.vertexPositionBuffer = gl.createBuffer();
		bufferArrayData(bufferObj.vertexPositionBuffer, sourceData.vertices, sourceData.vertices_len || 3);
		if (sourceData.uvcoords){
			bufferObj.vertexTextureCoordBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexTextureCoordBuffer, sourceData.uvcoords, 2);
		}
		if (sourceData.velocities){	//for exploding objects
			bufferObj.vertexVelocityBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexVelocityBuffer, sourceData.velocities, 3);
		}
		if (sourceData.normals){
			bufferObj.vertexNormalBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexNormalBuffer, sourceData.normals, 3);
		}
		if (sourceData.tangents){
			bufferObj.vertexTangentBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexTangentBuffer, sourceData.tangents, 3);
		}
		if (sourceData.binormals){
			bufferObj.vertexBinormalBuffer= gl.createBuffer();
			bufferArrayData(bufferObj.vertexBinormalBuffer, sourceData.binormals, 3);
		}
		bufferObj.vertexIndexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferObj.vertexIndexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sourceData.indices), gl.STATIC_DRAW);
		bufferObj.vertexIndexBuffer.itemSize = 3;
		bufferObj.vertexIndexBuffer.numItems = sourceData.indices.length;
	}
}
function bufferArrayData(buffer, arr, size){
    bufferArrayDataGeneral(buffer, new Float32Array(arr), size);
}
function bufferArrayDataGeneral(buffer, arr, size){
   //console.log("size:" + size);
   gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
   gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
   buffer.itemSize = size;
   buffer.numItems = arr.length / size;
}


function drawStuff(){
    requestAnimationFrame(drawStuff);
/*
    var activeShaderProgram = shaderPrograms.flatcolor;
    gl.useProgram(activeShaderProgram);
    gl.uniform4f(activeShaderProgram.uniforms.uColor, 1,0,0,1); //red
    drawObjectFromBuffers(fsBuffers, activeShaderProgram);
*/
    var activeShaderProgram = shaderPrograms.tex;
    gl.useProgram(activeShaderProgram);
    //bind2dTextureIfRequired(uncompressedTex);
    bind2dTextureIfRequired(compressedTex);
	gl.uniform1i(activeShaderProgram.uniforms.uSampler, 0);
    drawObjectFromBuffers(fsBuffers, activeShaderProgram);
}


function drawObjectFromBuffers(bufferObj, shaderProg, usesCubeMap, drawMethod){
	prepBuffersForDrawing(bufferObj, shaderProg, usesCubeMap);
	drawObjectFromPreppedBuffers(bufferObj, shaderProg, drawMethod);
}

function prepBuffersForDrawing(bufferObj, shaderProg, usesCubeMap){
	enableDisableAttributes(shaderProg);
	
	gl.bindBuffer(gl.ARRAY_BUFFER, bufferObj.vertexPositionBuffer);
    gl.vertexAttribPointer(shaderProg.attributes.aVertexPosition, bufferObj.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
	
	if (shaderProg.uniforms.uSampler){
		gl.uniform1i(shaderProg.uniforms.uSampler, 0);
	}
	
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferObj.vertexIndexBuffer);
}

function drawObjectFromPreppedBuffers(bufferObj, shaderProg, drawMethod){
	if (shaderProg.uniforms.uMVMatrix){
		gl.uniformMatrix4fv(shaderProg.uniforms.uMVMatrix, false, mvMatrix);
	}
	drawMethod = drawMethod || gl.TRIANGLES;
	gl.drawElements(drawMethod, bufferObj.vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
}


var enableDisableAttributes = (function generateEnableDisableAttributesFunc(){
	var numEnabled = 0;
	
	return function(shaderProg){
		
		var numToBeEnabled = shaderProg.numActiveAttribs;
		if (numToBeEnabled>numEnabled){
			for (var ii=numEnabled;ii<numToBeEnabled;ii++){
				gl.enableVertexAttribArray(ii);
			}
		}
		if (numToBeEnabled<numEnabled){
			for (var ii=numToBeEnabled;ii<numEnabled;ii++){
				gl.disableVertexAttribArray(ii);
			}
		}
		numEnabled = numToBeEnabled;
	};
})();

var uncompressedTex;
var compressedTex;
function initTexture(){
    //uncompressedTex = makeTexture("png-src/lena512gray.png");
     //uncompressedTex = makeTexture("png-src/47.png");
    //uncompressedTex = makeTexture("png-src/gradient_linear_512x512.png");

    uncompressedTex = makeTexture("png-src/lena512color.png");
    //uncompressedTex = makeTexture("png-src/baboon.png");
    compressedTex = makePlaceholderTexture();
}

function makePlaceholderTexture(){
	//dummy 1 pixel image to avoid error logs. https://stackoverflow.com/questions/21954036/dartweb-gl-render-warning-texture-bound-to-texture-unit-0-is-not-renderable
	var texture = gl.createTexture();
	bind2dTextureIfRequired(texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
		new Uint8Array([255, 0, 255, 255])); // magenta. should be obvious when tex not loaded.
	return texture;
}

function loadImage(src, callback){
    var image = new Image();
    image.onload=callback;
    image.src = src;
}

function makeTexture(src, yFlip = true) {	//to do OO
	var texture = makePlaceholderTexture();
    
    loadImage(src, function(loadInfo){
        var image = loadInfo.srcElement;
		bind2dTextureIfRequired(texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, yFlip);

		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	//linear colorspace grad light texture (TODO handle other texture differently?)
		
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		
        bind2dTextureIfRequired(null);	//AFAIK this is just good practice to unwanted side effect bugs
        
        setupCompressedTextureFromImage(image);
	});
	return texture;
}

function setupCompressedTextureFromImage(img){
    var canvas = document.createElement('canvas');
    canvas.width=img.width;
    canvas.height=img.height;
    var context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    var imgData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    setupCompressedTextureFromImagedata(imgData);
}

var timeMeasure = (function(){
    var lastTime = performance.now();

    return (mystring) => {
        var timeNow = performance.now();
        console.log("time measure. " + mystring + ":" + (timeNow - lastTime));
        lastTime=timeNow;
    }
})();


function setupCompressedTextureFromImagedata(u8data){
    var u32data = new Uint32Array(u8data.buffer);

    timeMeasure("start");

    console.log(u8data);
    console.log(u32data);   //see that u32data[0] =  256*256*256*u8data[0] + 256*256*u8data[1] + 256*u8data[2] + u8data[3]
                        //and can use this to modify or read whole pixel (4 channels) in 1 go

    var imgSize = 512;
    var blocksAcross = imgSize/4;
    var imgBlocks = blocksAcross*blocksAcross;

    var compressedData = new Uint32Array(imgBlocks*2);

    timeMeasure("done initial stuff");

    //go through original image, pick a pixel colour from corner of each block.
    for (var aa=0,pp=0;aa<blocksAcross;aa++,pp+=4){
        for (var bb=0,qq=0;bb<blocksAcross;bb++,qq+=4){
                //TODO use dataview? otherwise endianness might mess this up on other machines.
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
            /*
            var origPix = 4*(pp*imgSize + qq);   //todo get this from additions in loop
            var pixColorR = u8data[origPix];
            var pixColorG = u8data[origPix+1];
            var pixColorB = u8data[origPix+2];

            var newColor = ( (pixColorR >> 3 ) << 11 ) + ( (pixColorG >> 2 ) << 5 ) + (pixColorB >> 3 );
                //TODO is &&ing and shifting is faster than two shifts?
            */

            //naive color version - take hi,lo colors as (maxr,maxg,maxb) , (minr,ming,minb)
            //this should reproduce grayscale result, and work for some colour gradients, but
            //should do a poor job for gradients where one channel increases while another decreases, and doesn't take into account luma
            //does a good job on lena, but poor job on baboon (see red-blue transition around nose)

            //improved version might look to find regression line through points, and max,min values (or quartiles?) on that scale
            //though this risks sacrificing luma reproduction



            //pre pass to convert to 565 simple chequerboard dithered (but still in 888 after this pass)
            //reduces colour banding, near* ensures near flat colour areas have different locolor, hicolor
            // *fails near black or white
            //also looks interesting!
            //might want to add dither in last step (instead), in per pixel pallete choice.

            var doDitherPrepass;
            //doDitherPrepass=true;

            //this could go inside next loop
            if (doDitherPrepass){
                var u8clamped = new Uint8ClampedArray(u8data.buffer);

                var spread1 = 8;   
                var spread2 = 4;    //spread = pix values between consecutive 565 color value in 8-bit
                spread1/=2;spread2/=2;  //expected to work using above values , but appears to work better if halve. why?

                var toAdd, toAdd2, toAddB, toAddB2;

                var selectChequer
                selectChequer=false;

                if (selectChequer){
                    toAdd = (1/4)*spread1;      //chequerboard.
                    toAdd2 = (1/4)*spread2;
                    toAddB = 0;
                    toAddB2 = 0;
                }else{
                    toAdd = (3/8)*spread1;      //2x2 . unpleasant banding. guess is why 4x4 popular
                    toAdd2 = (3/8)*spread2;
                    toAddB = (1/3)*spread1;
                    toAddB2 = (1/3)*spread2;
                }

                for (var cc=0;cc<4;cc++){
                    for (var dd=0;dd<4;dd++){
                        origPix = 4*((pp+cc)*imgSize + qq + dd);

                        pixColorR = u8clamped[origPix];
                        pixColorR = ( pixColorR + toAdd + toAddB );
                        u8clamped[origPix]=pixColorR; // ^ 7;

                        pixColorG = u8clamped[origPix+1];
                        pixColorG = ( pixColorG + toAdd2 + toAddB2);
                        u8clamped[origPix+1]=pixColorG;// ^ 3;

                        pixColorB = u8clamped[origPix+2];
                        pixColorB = ( pixColorB + toAdd + toAddB );
                        u8clamped[origPix+2]=pixColorB;// ^ 7;

                        toAdd = -toAdd;
                        toAdd2 = -toAdd2;
                    }
                    toAddB = -toAddB;
                    toAddB2 = -toAddB2;
                    toAdd = -toAdd;
                    toAdd2 = -toAdd2;
                }

            }


           var maxR = 0;
           var minR = 255;
           var maxG = 0;
           var minG = 255;
           var maxB = 0;
           var minB = 255;
           
           var origPix;
           var pixColorR;
           var pixColorG;
           var pixColorB;

           for (var cc=0;cc<4;cc++){
                for (var dd=0;dd<4;dd++){
                    origPix = 4*((pp+cc)*imgSize + qq + dd);
                    pixColorR = u8data[origPix];     //TODO put to a local array so don't need to look up again in picker part
                    maxR = Math.max(maxR, pixColorR);
                    minR = Math.min(minR, pixColorR);
                    pixColorG = u8data[origPix+1];
                    maxG = Math.max(maxG, pixColorG);
                    minG = Math.min(minG, pixColorG);
                    pixColorB = u8data[origPix+2];
                    maxB = Math.max(maxB, pixColorB);
                    minB = Math.min(minB, pixColorB);
                }
           }

           //test
           /*
           minR =0;
           maxR=255;
           minG =0;
           maxG=255;
           minB =0;
           maxB=255;
           */

           //take off last bits so max/min vals are as will be stored
          
           minR = minR & (255-7);
           minG = minG & (255-3);
           minB = minB & (255-7);

           
           maxR=Math.min(255,(maxR & (255-7) )+8); //add some so max>min (at least in most cases)
           maxG=Math.min(255,(maxG & (255-3) )+4);
           maxB=Math.min(255,(maxB & (255-7) )+8);

           //note that 888<->565 is not as trivial as this. really 0-255 represents 0-1, 0-31, 0-63 does too.
           //suspect mostly doesn't really matter but that what doing now washes out top values 

           var diffR = maxR-minR; //+1 to avoid /0, theseBits=4.
           var diffG = maxG-minG;
           var diffB = maxB-minB;

           //go thru again, find where on scale each pixel is.
           var pickerPart = 0;
           var toAdd = 0.25;       //?? TODO what shift values to use whole range of 4 pallette values?
           if (doDitherPrepass){toAdd=0;} //switch off dithering for this stage
           for (var cc=0;cc<4;cc++){
                for (var dd=0;dd<4;dd++){
                    origPix = 4*((pp+cc)*imgSize + qq + (3-dd));
                    
                    pixColorR = u8data[origPix];
                    pixColorG = u8data[origPix+1];
                    pixColorB = u8data[origPix+2];

                    var theseBits = Math.min(3,Math.max(0, toAdd + ( ((pixColorR - minR)/diffR) + ((pixColorG - minG)/diffG) + ((pixColorB - minB)/diffB) )*1.3333));
                        //seems like significant bits are switched.  wierd order of c0,c1,c2,c3
                    //theseBits = [1,3,2,0][theseBits];   //likely inefficient formulation!
                    var bitA = (theseBits >> 1);
                    theseBits = ( 1-bitA )+ ( (( bitA + theseBits) & 1) <<1 );  //faster?

                    pickerPart = (pickerPart << 2);
                    pickerPart+=theseBits;

                    toAdd = -toAdd;
                }
                toAdd = -toAdd;
            }

           var hiColor = ( (maxR >> 3 ) << 11 ) + ( (maxG >> 2 ) << 5 ) + (maxB >> 3 );
           var loColor = ( (minR >> 3 ) << 11 ) + ( (minG >> 2 ) << 5 ) + (minB >> 3 );
           //var bothColor = (hiColor << 16 )+ loColor;    //expect this order c0>c1 for 4 colour levels, but gets transparency, so guess is wrong.
           var bothColor = (loColor << 16 )+ hiColor;

           if (loColor == hiColor){pickerPart=0;}
                //this might be missing out on something. by setting hi/lo different apart, might still benefit from the 4 shades
                //where colours in block resolve to same 565 value, but still differ in 888.

            newPix = 2*( (blocksAcross-1-aa)*blocksAcross + bb);    //note (blocksAcross-1-aa) instead of just aa, otherwise y flipped. 
            compressedData[newPix] = bothColor;

            //detect problems (red) - should ensure that have 2 colour pallete, since likely there are more than 1 original colours in the block
            if (loColor == hiColor){compressedData[newPix] = 0xf800;}

            compressedData[newPix+1] = pickerPart;
        }
    }

    timeMeasure("done main part");  //512x512 image takes ~10ms on i5 4690

    //var compressedDataUI8 = new Uint8Array(compressedData.buffer);    //can use this just as well as passing compressedData. 
                                                                        //presumably compressedTexImage2D uses buffer.
    
    const ext = gl.getExtension('WEBGL_compressed_texture_s3tc'); // will be null if not supported

    bind2dTextureIfRequired(compressedTex);
        //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, yFlip);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	
    //    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8data);
        gl.compressedTexImage2D(gl.TEXTURE_2D, 0, ext.COMPRESSED_RGBA_S3TC_DXT1_EXT, 512, 512, 0, compressedData); 
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    bind2dTextureIfRequired(null);

    timeMeasure("finished compressed tex setup");
}

var bind2dTextureIfRequired = (function createBind2dTextureIfRequiredFunction(){
	var currentlyBoundTextures=[];
	var currentBoundTex;
	return function(texToBind, texId = gl.TEXTURE0){	
		currentBoundTex = currentlyBoundTextures[texId];
        gl.activeTexture(texId);  
        if (texToBind != currentBoundTex){
			//gl.activeTexture(texId);
			gl.bindTexture(gl.TEXTURE_2D, texToBind);
			currentlyBoundTextures[texId] = texToBind;
		}
	}
})();