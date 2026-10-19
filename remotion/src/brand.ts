import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/600-italic.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/700.css";
import brandJson from "../../studio/brand/brand.json";

export const brand = brandJson;
export const C = brandJson.colors;
export const FONT_DISPLAY = `"${brandJson.fonts.display}", serif`;
export const FONT_BODY = `"${brandJson.fonts.body}", sans-serif`;
