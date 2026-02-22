import {createRouter, createWebHistory} from 'vue-router'
import AdminLayout from "@/views/layout/AdminLayout.vue";
import FrontLayout from "@/views/layout/FrontLayout.vue";

const router = createRouter({
    history: createWebHistory(),
    routes: getRoutes()
})

function getRoutes() {
    let defaultRoutes = [
        {
            path: '/',
            name:'front',
            component: FrontLayout,
            redirect: '/index',
            children: [
                {
                    path: 'index',
                    name: 'Index',
                    component: () =>
                        import('../views/front/Index.vue')
                },
                {
                    path: 'editCurrentUser',
                    name: 'front-editCurrentUser',
                    component: () =>
                        import ('../views/EditCurrentUser.vue')
                },
                {
                    path: 'editPassword',
                    name: 'front-editPassword',
                    component: () =>
                        import ('../views/EditPassword.vue')
                },
                {
                    path: "balanceInfo",
                    name: "front-balanceInfo",
                    component: () =>
                        import ('../views/BalanceInfo.vue')
                },
                {
                    path: 'productDetails/:id',
                    name: 'front-productDetails',
                    component: () => import('../views/front/ProductDetails.vue')
                },
                {
                    path: 'personalCenter',
                    name: 'front-personalCenter',
                    component: () => import('../views/front/PersonalCenter.vue')
                },
                {
                    path: 'productList',
                    name: 'front-productList',
                    component: () => import('../views/front/ProductList.vue')
                },
                {
                    path: 'shoppingCart',
                    name: 'front-shoppingCart',
                    component: () => import('../views/front/ShoppingCart.vue')
                },
                {
                    path: 'productOrder',
                    name: 'front-ProductOrder',
                    component: () => import('../views/front/ProductOrder.vue')
                },

            ]
        },
        {
            path: '/admin',
            name: 'admin',
            component: AdminLayout,
            redirect: "/admin/home",
            children: [{
                path: "home",
                name: "admin-home",
                component: () =>
                    import ('../views/admin/Home.vue')
            },
                {
                    path: 'editCurrentUser',
                    name: 'admin-editCurrentUser',
                    component: () =>
                        import ('../views/EditCurrentUser.vue')
                },
                {
                    path: 'editPassword',
                    name: 'admin-editPassword',
                    component: () =>
                        import ('../views/EditPassword.vue')
                },
                {
                    path: 'admin',
                    name: 'admin-admin',
                    component: () =>
                        import ('../views/admin/AdminManage.vue')
                },
                {
                    path:"user",
                    name:"admin-user",
                    component:() =>
                        import('../views/admin/UserManage.vue')
                },
                {
                    path: 'shop',
                    name: 'admin-shop',
                    component: () =>
                        import ('../views/admin/ShopManage.vue')
                },
                {
                    path: 'productType',
                    name: 'admin-productType',
                    component: () =>
                        import ('../views/admin/ProductTypeManage.vue')
                },
                {
                    path: 'productCollect',
                    name: 'admin-productCollect',
                    component: () =>
                        import ('../views/admin/ProductCollectManage.vue')
                },
                {
                    path: 'productBrowsingHistory',
                    name: 'admin-productBrowsingHistory',
                    component: () =>
                        import ('../views/admin/ProductBrowsingHistoryManage.vue')
                },
                {
                    path: 'product',
                    name: 'admin-product',
                    component: () =>
                        import ('../views/admin/ProductManage.vue')
                },
                {
                    path: 'shippingAddress',
                    name: 'admin-shippingAddress',
                    component: () =>
                        import ('../views/admin/ShippingAddressManage.vue')
                },
                {
                    path: 'productOrder',
                    name: 'admin-productOrder',
                    component: () =>
                        import ('../views/admin/ProductOrderManage.vue')
                },
                {
                    path: 'productOrderEvaluate',
                    name: 'admin-productOrderEvaluate',
                    component: () =>
                        import ('../views/admin/ProductOrderEvaluateManage.vue')
                },
                {
                    path: 'shopCollect',
                    name: 'admin-shopCollect',
                    component: () =>
                        import ('../views/admin/ShopCollectManage.vue')
                },
                {
                    path: 'advertising',
                    name: 'admin-advertising',
                    component: () =>
                        import ('../views/admin/AdvertisingManage.vue')
                },
                {
                    path: 'slideshow',
                    name: 'admin-slideshow',
                    component: () =>
                        import ('../views/admin/SlideshowManage.vue')
                },
            ]
        },
        {
            path: "/login",
            name: "login",
            component: () =>
                import ('../views/Login.vue')
        }, {
            path: "/register",
            name: "register",
            component: () =>
                import ('../views/Register.vue')
        }, {
            path: "/retrievePassword",
            name: "front-retrievePassword",
            component: () =>
                import ('../views/RetrievePassword.vue')
        }];
    defaultRoutes.push({
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        meta: {
            name: ''
        },
        component: () => import ('../views/404.vue')
    })
    console.log('getDynamicRoutes', defaultRoutes)
    return defaultRoutes;
}

router.beforeEach((to, from, next) => {
    next();
});
export default router
