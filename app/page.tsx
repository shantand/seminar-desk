import Desk from './desk';
import { requireAdminUser } from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireAdminUser('/');return <Desk displayName={user.displayName}/>;}
