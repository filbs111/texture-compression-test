//1 draw a quad to the screen
//2 use a texture. load or procedural. procedural gradient should be useful
//3 attempt generating dxt1. min=max colour and zeros for per pixel part should suffice.
//4 pull out correct min, max colours, set bits correctly
//5 benchmark it. have a go at some optimisation
//6 gpu implementation!

const TEX_SIZE=512;const testImageAddress = "png-src/lena512color.png";
//const TEX_SIZE=512;const testImageAddress = "png-src/baboon.png";
//const TEX_SIZE=1024;const testImageAddress = "raw-src/sunset.webp";

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

    canvas.width = TEX_SIZE * 2;    //for drawing 2 images side by side
    canvas.height = TEX_SIZE * 2;

    initGL();
    console.log({gl});
    initShaders();
    initTextures();
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
    shaderPrograms.texDxt5 = loadShader("shader-basic-vs", "shader-tex-fs-dxt5");
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
    bind2dTextureIfRequired(uncompressedTexture0);
	gl.uniform1i(activeShaderProgram.uniforms.uSampler, 0);
  
    gl.uniform3f(activeShaderProgram.uniforms.uCentrePos, -0.5,0.5,0);
    gl.uniform3f(activeShaderProgram.uniforms.uScale, 0.5,0.5,1);

    drawObjectFromBuffers(fsBuffers, activeShaderProgram);

    //
    bind2dTextureIfRequired(compressedTexDxt1);
	gl.uniform1i(activeShaderProgram.uniforms.uSampler, 0);
  
    gl.uniform3f(activeShaderProgram.uniforms.uCentrePos, 0.5,0.5,0);
    gl.uniform3f(activeShaderProgram.uniforms.uScale, 0.5,0.5,1);

    drawObjectFromBuffers(fsBuffers, activeShaderProgram);


    //---------------------------------------------------------

    var activeShaderProgram = shaderPrograms.texDxt5;
    gl.useProgram(activeShaderProgram);
    bind2dTextureIfRequired(compressedTexDxt5);
	gl.uniform1i(activeShaderProgram.uniforms.uSampler, 0);
  
    gl.uniform3f(activeShaderProgram.uniforms.uCentrePos, -0.5,-0.5,0);
    gl.uniform3f(activeShaderProgram.uniforms.uScale, 0.5,0.5,1);

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

var uncompressedTexture0;
var compressedTexDxt1;
var compressedTexDxt5;

function initTextures(){
    uncompressedTexture0 = makePlaceholderTexture();
    compressedTexDxt1 = makePlaceholderTexture();
    compressedTexDxt5 = makePlaceholderTexture();
    
    makeCompressedTexture(testImageAddress, compressedTexDxt1, setupCompressedTextureDxt1FromImagedata);
    makeCompressedTexture(testImageAddress, compressedTexDxt5, setupCompressedTextureDxt5FromImagedata);
    

    function makeCompressedTexture(testImageAddress, texture, setupFunc){
        makeTexture(testImageAddress, 
            image=>{
    
                var numLevels = 1 + Math.log2(TEX_SIZE);
    
                var imgDataArr = setupCompressedTextureFromImage(image, numLevels); //TODO reuse DXT1 result? 
                var mipSize = TEX_SIZE;
                for (var mipLevel=0;mipLevel<imgDataArr.length;mipLevel++){
                    setupFunc(imgDataArr[mipLevel], texture, mipLevel, mipSize);
                    mipSize/=2;
                }
                //finalise setup? (maybe this shoudl come at the end)
                bind2dTextureIfRequired(texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    
                bind2dTextureIfRequired(null);
        });
    }

    


    //a regular texture
    //uncompressedTexture0 = gl.createTexture();
    var imageToLoad = new Image();
	imageToLoad.onload = ()=> {
        //TODO generalise better - below is contained within makeTexture too.
        //TODO don't load twice (for uncompressed then for creating compressed)
        bind2dTextureIfRequired(uncompressedTexture0);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	
        //note this is different to 3sphere code because that's webgl2!
        //in webgl 1 can't specify dimensions if loading from an image!
        // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D
        
        // full colour. can be relevant to full colour
        //most examples from jpeg, webp source are 565 already. if want to download textures in regular compression then transcode,
        // full colour images (eg non-lossy webp) are big anyway, so may as well just download DXT result.
        // but perhaps AVIF makes this relevant, and also is relevant for compressing procedural images - eg infrequently rendered reflection cubemaps
        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
        //     //TEX_SIZE, TEX_SIZE, 0, 
        //     gl.RGBA, gl.UNSIGNED_BYTE,
        //     imageToLoad);     

        //565. 
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 
            //TEX_SIZE, TEX_SIZE, 0, 
            gl.RGB, gl.UNSIGNED_SHORT_5_6_5,
            imageToLoad);  

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

        gl.generateMipmap(gl.TEXTURE_2D);


        bind2dTextureIfRequired(null);
    };
    imageToLoad.src = testImageAddress;
    

    //DXT5.
    // many options to encode, but say encode as r',g',b' = (r,g,b)/(r+g+b) , a' = r+g+b, then can get back original
    // r,g,b = (r',g',b')*a',
    //but this loses some precision, since alpha should be scaled so = 1 at (1,1,1), =1/3 at (1,0,0), (0,1,0), (0,0,1)
    //instead might encode 
    // a' = max(r,g,b)
    //then to reconstruct
    // r,g,b = (r',g',b') * a'*max(r',g',b')
    // but perhaps this is inefficient

    //perhaps instead of r+g+b do, say, r+2g+b
    //since want to emulate 565 anyway

    //or just store green in alpha, r,b in rgb (either don't use one channel r'=0, g'=r, b'=b, a'=g , so have ~8bit green, 6 bit red, 5 bit blue
    // or store b across r',b' diagonally (shifted by half a step?) to get extra bit?
    // suppose have simple, 685 bits, seems decent fit for luma.
    

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

function makeTexture(src, cb, yFlip = true) {	//to do OO
	var texture = makePlaceholderTexture();
    
    loadImage(src, function(loadInfo){
        var startTime = performance.now();

        var image = loadInfo.srcElement;
		bind2dTextureIfRequired(texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, yFlip);

		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	//linear colorspace grad light texture (TODO handle other texture differently?)
		
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		
        bind2dTextureIfRequired(null);	//AFAIK this is just good practice to unwanted side effect bugs
        
        cb(image);

        var endTime = performance.now();
        console.log(`callback took ${endTime - startTime} milliseconds`)
	});
	return texture;
}

function setupCompressedTextureFromImage(img, numlevels){
    var canvas = document.createElement('canvas');
    canvas.width=img.width;
    canvas.height=img.height;
    var context = canvas.getContext('2d');

    var imgDataArr=[];

    var dstSize = TEX_SIZE;

    for (var ii=0;ii<numlevels;ii++){
        context.drawImage(img, 0, 0, TEX_SIZE,TEX_SIZE, 0,0, dstSize,dstSize);

        //context.fillStyle=["red","green","blue","yellow","cyan","magenta"][ii%6];
        //context.fillRect(0,0,100,100);  //make mip level obvious

        imgDataArr.push( context.getImageData(0, 0, dstSize, dstSize).data );
        if (dstSize>4){dstSize/=2;}
            //^^ so have at least 1 4x4 block
    }

    console.log(imgDataArr);

    return imgDataArr;
}

var timeMeasure = (function(){
    var lastTime = performance.now();

    return (mystring) => {
        var timeNow = performance.now();
        console.log("time measure. " + mystring + ":" + (timeNow - lastTime));
        lastTime=timeNow;
    }
})();


function setupCompressedTextureDxt1FromImagedata(u8data, compressedTexToSetUp, mipLevel, mipTexSize){
    var u32data = new Uint32Array(u8data.buffer);

    console.log(u8data);
    console.log(u32data);   //see that u32data[0] =  256*256*256*u8data[0] + 256*256*u8data[1] + 256*u8data[2] + u8data[3]
                        //and can use this to modify or read whole pixel (4 channels) in 1 go

    timeMeasure("start");

    var mipSize = Math.max(4,mipTexSize);

    var blocksAcross = mipSize/4;
    var imgBlocks = blocksAcross*blocksAcross;

    var compressedData = new Uint32Array(imgBlocks*2);

    timeMeasure("done initial stuff");

    //go through original image, pick a pixel colour from corner of each block.
    for (var aa=0,pp=0;aa<blocksAcross;aa++,pp+=4){
        for (var bb=0,qq=0;bb<blocksAcross;bb++,qq+=4){
                //TODO use dataview? otherwise endianness might mess this up on other machines.
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView
            /*
            var origPix = 4*(pp*mipSize + qq);   //todo get this from additions in loop
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
            doDitherPrepass=true;

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
                        origPix = 4*((pp+cc)*mipSize + qq + dd);

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
                    origPix = 4*((pp+cc)*mipSize + qq + dd);
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
                    origPix = 4*((pp+cc)*mipSize + qq + (3-dd));
                    
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

           //override colours for debug
           // hiColor = 0xffff;
           // loColor=0x0000;

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
    
    var ext = gl.getExtension('WEBGL_compressed_texture_s3tc'); // will be null if not supported

    console.log("will set up texture level " + mipLevel + " with dimensions " + mipSize);

    bind2dTextureIfRequired(compressedTexToSetUp);
        //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, yFlip);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	
    //    gl.texImage2D(gl.TEXTURE_2D, mipLevel, gl.RGBA, mipSize, mipSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8data);
        gl.compressedTexImage2D(gl.TEXTURE_2D, mipLevel, ext.COMPRESSED_RGB_S3TC_DXT1_EXT, mipTexSize, mipTexSize, 0, compressedData); 
        
  //      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
   //     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    bind2dTextureIfRequired(null);

    timeMeasure("finished compressed tex setup");
}


/*
basic version. store green in alpha, red, blue in gb, pallete is simple minmax
*/
function setupCompressedTextureDxt5FromImagedata(u8data, compressedTexToSetUp, mipLevel, mipTexSize){
    var u32data = new Uint32Array(u8data.buffer);

    timeMeasure("start");

    var mipSize = Math.max(4,mipTexSize);

    var blocksAcross = mipSize/4;
    var imgBlocks = blocksAcross*blocksAcross;

    var compressedData = new Uint32Array(imgBlocks*4);

    timeMeasure("done initial stuff");

    //go through original image, pick a pixel colour from corner of each block.
    for (var aa=0,pp=0;aa<blocksAcross;aa++,pp+=4){
        for (var bb=0,qq=0;bb<blocksAcross;bb++,qq+=4){
                //TODO use dataview? otherwise endianness might mess this up on other machines.
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView

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
                    origPix = 4*((pp+cc)*mipSize + qq + dd);
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


           //take off last bits so max/min vals are as will be stored          
           minR = minR & (255-3);
           minB = minB & (255-7);
           
           maxR=Math.min(255,(maxR & (255-3) )+4); //add some so max>min (at least in most cases)
           maxB=Math.min(255,(maxB & (255-7) )+8);

           //override TODO don't do this
           //minG = 0;
           //maxG=255;

            //bodge? doesn't seem to do much
            //minG = Math.max(0,minG-5);
            //maxG = Math.min(255,maxG+5);
          


           var diffR = maxR-minR; //+1 to avoid /0, theseBits=4.
           var diffG = maxG-minG;
           var diffB = maxB-minB;

           //go thru again, find where on scale each pixel is.
           var pickerPart = 0;
           var alphaPickerPart = 0;
           var toAdd = 0.25;       //?? TODO what shift values to use whole range of 4 pallette values?
           //var toAddAlpha = 0.125;  //guess. TODO use?
           for (var cc=0;cc<4;cc++){
                for (var dd=0;dd<4;dd++){
                    origPix = 4*((pp+cc)*mipSize + qq + (3-dd));
                    
                    pixColorR = u8data[origPix];
                    pixColorG = u8data[origPix+1];
                    pixColorB = u8data[origPix+2];

                    var theseBits = Math.min(3,Math.max(0, toAdd + ( ((pixColorR - minR)/diffR) + ((pixColorB - minB)/diffB) )*2));
                        //seems like significant bits are switched.  wierd order of c0,c1,c2,c3

                    theseBits =  [1,3,2,0][Math.floor(theseBits)];

                    //theseBits = [1,3,2,0][theseBits];   //likely inefficient formulation!

                    //var bitA = (theseBits >> 1);
                    //theseBits = ( 1-bitA )+ ( (( bitA + theseBits) & 1) <<1 );  //faster?

                    pickerPart = (pickerPart << 2);
                    pickerPart+=theseBits;

                    toAdd = -toAdd;

                    //do similar to hold green in alpha channel
                    var theseAlphaBits = Math.floor(0.5+ Math.min(7,Math.max(0, 0+ 7*(pixColorG - minG)/diffG)));

                    //wierd order https://en.wikipedia.org/wiki/S3_Texture_Compression
                    theseAlphaBits = [1,7,6,5,4,3,2,0][theseAlphaBits];
                    
                    alphaPickerPart = alphaPickerPart*8;
                    alphaPickerPart+=theseAlphaBits;
                }
                toAdd = -toAdd;
            }

           var hiColor = ( (maxR >> 2 ) << 5 ) + (maxB >> 3 );
           var loColor = ( (minR >> 2 ) << 5 ) + (minB >> 3 );

           //override colours for debug
           // hiColor = 0xffff;
           // loColor=0x0000;

           //var bothColor = (hiColor << 16 )+ loColor;    //expect this order c0>c1 for 4 colour levels, but gets transparency, so guess is wrong.
           var bothColor = (loColor << 16 )+ hiColor;

           if (loColor == hiColor){pickerPart=0;}
                //this might be missing out on something. by setting hi/lo different apart, might still benefit from the 4 shades
                //where colours in block resolve to same 565 value, but still differ in 888.

            newPix = 4*( (blocksAcross-1-aa)*blocksAcross + bb);    //note (blocksAcross-1-aa) instead of just aa, otherwise y flipped. 
            compressedData[newPix+2] = bothColor;

            //detect problems (red) - should ensure that have 2 colour pallete, since likely there are more than 1 original colours in the block
            //if (loColor == hiColor){compressedData[newPix+2] = 0xf800;}

            compressedData[newPix+3] = pickerPart;


            //alpha part. colours are 16 bits, picker parts are 48 bits, making this awkward
            // TODO improve this? 16 bit data view?
            var hiAlpha = maxG;
            var loAlpha = minG;

            //override for sanity check
            //hiAlpha =255;
            //loAlpha =0;

            var bothAlpha = loAlpha *256 + hiAlpha;

            if (hiAlpha == loAlpha){
                alphaPickerPart=0;
                compressedData[newPix] = bothAlpha; //be explicit about this in an if (should just be able to proceed below though if just ensure
                        //there's always a difference.)
                compressedData[newPix+1] = 0;
            }else{

                var first16BitsOfAlphaPickerPart = Math.floor( alphaPickerPart / 0x100000000 ); //shitty but hope to prove concept
                var first32BitsOfAlphaPickerPart = Math.floor( alphaPickerPart / 0x10000 );
                var last16BitsOfAlphaPickerPart = alphaPickerPart - (first32BitsOfAlphaPickerPart* 0x10000);
                var last32BitsOfAlphaPickerPart = alphaPickerPart - (first16BitsOfAlphaPickerPart* 0x100000000);

                var first16OfLast32 = Math.floor(last32BitsOfAlphaPickerPart/0x10000);
                var last16OfLast32 = last16BitsOfAlphaPickerPart;

                compressedData[newPix] = bothAlpha + (last16OfLast32 * 0x10000);
                compressedData[newPix+1] = (first16BitsOfAlphaPickerPart*0x10000)+ first16OfLast32;
            }

        }
    }

    timeMeasure("done main part");  //512x512 image takes ~10ms on i5 4690

    //var compressedDataUI8 = new Uint8Array(compressedData.buffer);    //can use this just as well as passing compressedData. 
                                                                        //presumably compressedTexImage2D uses buffer.
    
    var ext = gl.getExtension('WEBGL_compressed_texture_s3tc'); // will be null if not supported

    console.log("will set up texture level " + mipLevel + " with dimensions " + mipSize);

    bind2dTextureIfRequired(compressedTexToSetUp);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);	
    gl.compressedTexImage2D(gl.TEXTURE_2D, mipLevel, ext.COMPRESSED_RGBA_S3TC_DXT5_EXT, mipTexSize, mipTexSize, 0, compressedData); 
    
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