import { supabase } from '../../lib/supabase'
import type { ClientRecord } from '../admin/admin-api'
import type { PlatformRecord, SocialAccountRecord } from '../publishing/publishing-api'

export type BrandAssetCategory='logo'|'talent'|'office_broll'|'product'|'screenshots'|'workshop_event'|'intro_outro'|'other'
export interface BrandAssetRecord { id:string;workspace_id:string;client_id:string;name:string;category:BrandAssetCategory;description:string|null;location:string;tags:string[];is_recommended:boolean;usage_notes:string|null;status:'active'|'archived';created_at:string;updated_at:string }
export interface BrandSocialAccount extends SocialAccountRecord { followers:number|null;followers_updated_at:string|null;followers_data_source:string|null;note:string|null;updated_at:string }
export interface BrandBundle { brand:ClientRecord|null;platforms:PlatformRecord[];accounts:BrandSocialAccount[];assets:BrandAssetRecord[] }

function fail(error:{message:string}|null){if(error)throw new Error(error.message)}
export async function loadBrandBundle(workspaceId:string):Promise<BrandBundle>{
  const brandResult=await supabase.from('clients').select('id,workspace_id,name,code,industry,description,brand_notes,status,ownership_type,is_default_brand,created_at,updated_at').eq('workspace_id',workspaceId).eq('ownership_type','internal_brand').eq('is_default_brand',true).maybeSingle();fail(brandResult.error)
  const brand=brandResult.data as ClientRecord|null
  if(!brand)return{brand:null,platforms:[],accounts:[],assets:[]}
  const[platforms,accounts,assets]=await Promise.all([
    supabase.from('platforms').select('id,code,name').in('code',['facebook','instagram','youtube','tiktok','xhs','threads','lemon8']).eq('is_active',true).order('sort_order'),
    supabase.from('social_accounts').select('id,client_id,platform_id,account_name,account_handle,external_url,is_active,followers,followers_updated_at,followers_data_source,note,updated_at').eq('client_id',brand.id).order('account_name'),
    supabase.from('brand_assets').select('id,workspace_id,client_id,name,category,description,location,tags,is_recommended,usage_notes,status,created_at,updated_at').eq('client_id',brand.id).order('is_recommended',{ascending:false}).order('updated_at',{ascending:false}),
  ]);fail(platforms.error);fail(accounts.error);fail(assets.error)
  return{brand,platforms:(platforms.data??[]) as PlatformRecord[],accounts:(accounts.data??[]) as BrandSocialAccount[],assets:(assets.data??[]) as BrandAssetRecord[]}
}
export async function loadBrandAccounts(workspaceId:string){const bundle=await loadBrandBundle(workspaceId);return{brand:bundle.brand,platforms:bundle.platforms,accounts:bundle.accounts}}
export async function saveBrandAccount(values:{id?:string;clientId:string;platformId:string;name:string;handle:string;url:string;followers:string;active:boolean;note:string}){const{data,error}=await supabase.rpc('save_brand_social_account',{target_account_id:values.id??null,target_client_id:values.clientId,target_platform_id:values.platformId,target_account_name:values.name,target_account_handle:values.handle,target_external_url:values.url,target_followers:values.followers.trim()===''?null:Number(values.followers),target_active:values.active,target_note:values.note});fail(error);return data as string}
export async function saveBrandAsset(values:{id?:string;clientId:string;name:string;category:BrandAssetCategory;description:string;location:string;tags:string[];recommended:boolean;usageNotes:string;status:'active'|'archived'}){const{data,error}=await supabase.rpc('save_brand_asset',{target_asset_id:values.id??null,target_client_id:values.clientId,target_name:values.name,target_category:values.category,target_description:values.description,target_location:values.location,target_tags:values.tags,target_recommended:values.recommended,target_usage_notes:values.usageNotes,target_status:values.status});fail(error);return data as string}
export async function updateBrandFollowers(accountId:string,followers:string){
  const{error}=await supabase.rpc('update_brand_social_followers',{target_account_id:accountId,target_followers:followers.trim()===''?null:Number(followers),target_data_source:'Manual'});fail(error)
}