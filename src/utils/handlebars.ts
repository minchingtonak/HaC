import { HandlebarsInstance } from "@hac/templates/handlebars";

/**
 * The shared Handlebars instance for the HaC project.
 * All custom helpers should be registered on this instance.
 */
export const sharedHandlebars = new HandlebarsInstance();
