import html from './build/index.html';

const API='https://ep-hidden-violet-a6lai2wg.apirest.us-west-2.aws.neon.tech/neondb/rest/v1';

export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(url.pathname==='/api/finance'){
      if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':url.origin,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'authorization','access-control-max-age':'86400'} });
      if(request.method!=='GET') return Response.json({error:'method not allowed'},{status:405});
      const token=request.headers.get('Authorization');
      if(!token) return Response.json({error:'missing authorization'},{status:401});
      const headers={Authorization:token};
      try{
        const read=async path=>{const response=await fetch(API+path,{headers});const data=await response.json();return {status:response.status,ok:response.ok,data};};
        const [accounts,worth,purchases,items,products,transactions,legs]=await Promise.all([
          read('/account_balances?select=*'),
          read('/net_worth_by_currency?select=*'),
          read('/purchases?select=id,transaction_id,purchased_at,currency_code'),
          read('/purchase_items?select=purchase_id,product_id,receipt_label,line_total'),
          read('/products?select=id,category'),
          read('/transactions?select=id,occurred_at,transaction_type,description'),
          read('/transaction_legs?select=transaction_id,amount,currency_code')
        ]);
        const queries=[accounts,worth,purchases,items,products,transactions,legs];
        const failed=queries.filter(x=>!x.ok);
        if(failed.length) return Response.json({error:'Neon Data API query failed',queries:queries.map(x=>({status:x.status,ok:x.ok,data:x.data}))},{status:502});
        const purchaseByTransactionId=new Map(purchases.data.map(x=>[String(x.transaction_id),x]));
        const itemsByPurchaseId=new Map();
        for(const item of items.data){const key=String(item.purchase_id);itemsByPurchaseId.set(key,[...(itemsByPurchaseId.get(key)||[]),item]);}
        const categoryByProductId=new Map(products.data.map(x=>[String(x.id),x.category||'Sin clasificar']));
        const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        const categoryFromLabel=label=>{
          const text=normalize(label);
          if(/carne|costilla|churrasco|cecina|chorizo|pollo|burger|hamburg/.test(text)) return 'Carnes';
          if(/uva|platano|banana|fresa|arandano|kiwi|limon|palta|pepino|tomate|zanahoria|brocoli|col morada|esparrago|verdura|fruta/.test(text)) return 'Frutas y verduras';
          if(/yogur|leche|queso/.test(text)) return 'Lácteos';
          if(/cafe|jugo|frugo|inca kola|gaseosa|bebida/.test(text)) return 'Bebidas';
          if(/detergente|suavitel|ambientador|gel pato|bolsa|tropbolsa/.test(text)) return 'Limpieza';
          if(/jabon|papel sanitario|kotex|venus/.test(text)) return 'Higiene';
          if(/lapiz|libreta|post-it|portaminas|tijera/.test(text)) return 'Papelería';
          if(/atun|huevo|pan|arroz|cereal|frutos secos/.test(text)) return 'Alimentos';
          if(/cbo |churrita/.test(text)||text.includes('q/t')) return 'Comidas fuera de casa';
          if(/gasolina|petrochicas|mototaxi/.test(text)) return 'Transporte';
          if(/efectibank/.test(text)) return 'Deudas y cuotas';
          if(/movistar|apple\.com|suscripcion|qvapay gold/.test(text)) return 'Servicios y suscripciones';
          if(/bici|cable usb|termos|camara 700|forro de timon/.test(text)) return 'Bici y accesorios';
          if(/plancha/.test(text)) return 'Hogar';
          return 'Otros';
        };
        const categoryGroups=new Map(),spendingGroups=new Map();
        const add=(map,key,value)=>map.set(key,(map.get(key)||0)+Number(value||0));
        const expenseTransactions=new Map(transactions.data.filter(x=>x.transaction_type==='expense').map(x=>[String(x.id),x]));
        for(const leg of legs.data){const transaction=expenseTransactions.get(String(leg.transaction_id));if(!transaction||Number(leg.amount)>=0)continue;const month=String(transaction.occurred_at).slice(0,7)+'-01';const total=-Number(leg.amount);add(spendingGroups,[month,leg.currency_code].join('|'),total);const purchase=purchaseByTransactionId.get(String(transaction.id));const purchaseItems=purchase?itemsByPurchaseId.get(String(purchase.id)):null;if(purchaseItems?.length){const itemsTotal=purchaseItems.reduce((sum,item)=>sum+Number(item.line_total||0),0);for(const item of purchaseItems){const category=categoryByProductId.get(String(item.product_id))||categoryFromLabel(item.receipt_label);add(categoryGroups,[month,leg.currency_code,category].join('|'),total*(Number(item.line_total||0)/itemsTotal));}}else{add(categoryGroups,[month,leg.currency_code,categoryFromLabel(transaction.description)].join('|'),total);}}
        const categories=[...categoryGroups.entries()].map(([key,total])=>{const [month,currency_code,category]=key.split('|');return {month,currency_code,category,total};});
        const spending=[...spendingGroups.entries()].map(([key,total])=>{const [month,currency_code]=key.split('|');return {month,currency_code,total};});
        return Response.json({accounts:Array.isArray(accounts.data)?accounts.data:[],worth:Array.isArray(worth.data)?worth.data:[],spending,categories,updatedAt:new Date().toISOString()},{headers:{'cache-control':'no-store'}});
      }catch(error){return Response.json({error:'Neon request failed'},{status:502});}
    }
    return new Response(html,{headers:{'content-type':'text/html;charset=UTF-8'}});
  }
};