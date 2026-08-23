export default function handler(request,response){
  response.setHeader('Cache-Control','no-store');
  response.status(200).json({
    url:process.env.SUPABASE_URL||'',
    key:process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||''
  });
}
