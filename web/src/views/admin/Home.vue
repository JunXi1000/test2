<template>
  <div>
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <ProductSalesTotalAmountChart/>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <ProductTypeProportionOfChart/>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
<script setup>
import {defineComponent, ref} from "vue";
import ProductSalesTotalAmountChart from "@/views/admin/chat/ProductSalesTotalAmountChart.vue";
import ProductTypeProportionOfChart from "@/views/admin/chat/ProductTypeProportionOfChart.vue";
import tools from "@/utils/tools.js";

const currentUser = ref(tools.getCurrentUser())
</script>
