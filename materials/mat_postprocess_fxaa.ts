import {link, Material} from "../common/material.js";
import {GL_TRIANGLES} from "../common/webgl.js";
import {PostprocessLayout} from "./layout.js";

let vertex = `#version 300 es\n
    in vec3 attr_position;
    in vec2 attr_texcoord;
    out vec2 vert_texcoord;

    void main() {
        gl_Position = vec4(attr_position, 1.0);
        vert_texcoord = attr_texcoord;
    }
`;

let fragment = `#version 300 es\n
    precision mediump float;

    uniform sampler2D sampler;
    uniform vec2 viewport_size;

    in vec2 vert_texcoord;
    out vec4 frag_color;

    #define FXAA_REDUCE_MIN   (1.0/ 128.0)
    #define FXAA_REDUCE_MUL   (1.0 / 8.0)
    #define FXAA_SPAN_MAX     8.0

    // https://github.com/mitsuhiko/webgl-meincraft/blob/master/assets/shaders/fxaa.glsl
    // https://github.com/mattdesl/glsl-fxaa/blob/master/fxaa.glsl
    vec4 fxaa(sampler2D tex, vec2 fragCoord) {
        vec4 color;
        vec2 inverseVP = vec2(1.0 / viewport_size.x, 1.0 / viewport_size.y);
        vec3 rgbNW = texture(tex, (fragCoord + vec2(-1.0, -1.0)) * inverseVP).xyz;
        vec3 rgbNE = texture(tex, (fragCoord + vec2(1.0, -1.0)) * inverseVP).xyz;
        vec3 rgbSW = texture(tex, (fragCoord + vec2(-1.0, 1.0)) * inverseVP).xyz;
        vec3 rgbSE = texture(tex, (fragCoord + vec2(1.0, 1.0)) * inverseVP).xyz;
        vec3 rgbM  = texture(tex, fragCoord  * inverseVP).xyz;

        vec3 luma = vec3(0.299, 0.587, 0.114);
        float lumaNW = dot(rgbNW, luma);
        float lumaNE = dot(rgbNE, luma);
        float lumaSW = dot(rgbSW, luma);
        float lumaSE = dot(rgbSE, luma);
        float lumaM  = dot(rgbM,  luma);
        float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
        float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

        vec2 dir;
        dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
        dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

        float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *
                            (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);

        float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
        dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),
                max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),
                dir * rcpDirMin)) * inverseVP;

        vec3 rgbA = 0.5 * (
            texture(tex, fragCoord * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz +
            texture(tex, fragCoord * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);
        vec3 rgbB = rgbA * 0.5 + 0.25 * (
            texture(tex, fragCoord * inverseVP + dir * -0.5).xyz +
            texture(tex, fragCoord * inverseVP + dir * 0.5).xyz);

        float lumaB = dot(rgbB, luma);
        if ((lumaB < lumaMin) || (lumaB > lumaMax))
            color = vec4(rgbA, 1.0);
        else
            color = vec4(rgbB, 1.0);
        return color;
    }

    void main() {
        //frag_color = fxaa(sampler, vert_texcoord * vec2(1, -1));
        frag_color = fxaa(sampler, gl_FragCoord.xy);
    }
`;

export function mat_postprocess_fxaa(gl: WebGL2RenderingContext): Material<PostprocessLayout> {
    let program = link(gl, vertex, fragment);
    return {
        Mode: GL_TRIANGLES,
        Program: program,
        Locations: {
            Sampler: gl.getUniformLocation(program, "sampler")!,
            ViewportSize: gl.getUniformLocation(program, "viewport_size")!,
            VertexPosition: gl.getAttribLocation(program, "attr_position")!,
            VertexTexcoord: gl.getAttribLocation(program, "attr_texcoord")!,
        },
    };
}
