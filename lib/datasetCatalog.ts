import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import products from "@/config/dataset-products.json";
import { canPurchase, type DatasetProduct } from "@/lib/datasetProduct";

export const datasetProducts = products as DatasetProduct[];
export const getDatasetCatalog = cache(async () => {
  const generated = JSON.parse(await readFile(path.join(process.cwd(),"data/static/dataset-catalog.json"),"utf8"));
  return datasetProducts.filter(product=>product.status!=="draft").map(product=>{
    const edition = generated.find((entry:any)=>entry.slug===product.slug);
    return {product,edition,purchasable:canPurchase(product,edition?.dataVersion??"",Boolean(edition?.filesReady))};
  });
});
