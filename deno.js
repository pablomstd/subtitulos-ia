import app from './core.js';
Deno.serve(request=>app.fetch(request,Deno.env.toObject()));
