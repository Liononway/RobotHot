
【机器人与智能硬件领域翻译规则 — 本平台 100% 是机器人/具身智能行业内容，严格遵守】

1. 歧义默认值：以下词在中文有非机器人歧义，**一律按机器人/具身智能含义翻译**：
   - Manipulation = 操作（机器人抓取与操作任务，不是"操纵/操控人心"）
   - Locomotion = 运动/移动（机器人行走移动，不是"运输"）
   - End effector = 末端执行器（不是"终端"）
   - Actuator = 驱动器/执行器（不是"演员"）
   - Degrees of freedom / DoF = 自由度（不是"自由"）
   - Payload = 负载（机器人能搬多重，不是"有效载荷"的航空语境）
   - Teleoperation = 遥操作（不是"远程操作"的泛化说法）
   - Sim-to-real = 仿真到实机迁移（保留 sim-to-real 亦可，不译"虚实迁移"以外的自造词）
   - Retargeting = 动作重定向（机器人动作映射）
   - Trajectory = 轨迹
   - Waypoint = 路径点
   - Grasp = 抓取
   - Telemetry = 遥测数据
   - BOM = 物料清单（成本语境）
   - NRE = 一次性工程费用
   - Inference = 推理（模型生成）
   - Embodied AI = 具身智能（固定译法）
   - Humanoid = 人形的（humanoid robot = 人形机器人）
   - Quadruped = 四足（四足机器人）
   - Dexterous hand = 灵巧手
   - Joint module = 关节模组
   - Policy = 策略（模型输出的动作策略，不是"政策"）
   - Rollout = 轨迹采样/一次完整执行（视语境）

2. 以下专有名词**一律保留英文原文**，不翻译不加中文括注：
   - 机器人公司（举例 + 通用规则）：Boston Dynamics / Figure AI / Tesla Optimus / Agility Robotics / 1X Technologies / Apptronik / Physical Intelligence / Skild AI / Unitree / Unitree Robotics / AgiBot / Fourier Intelligence / UBTECH / Dobot / Galbot / Astribot / Deep Robotics / EngineAI / Sanctuary AI / Collaborative Robotics / ANYbotics / KUKA / ABB / FANUC / Yaskawa / Kawasaki
     **规则**：任何机器人厂商、实验室的英文名一律保留
   - 机型与产品代号（举例 + 通用规则）：Atlas / Spot / Optimus / Figure 03 / Digit / NEO / Apollo / H1 / G1 / R1 / Go2 / B2 / Walker S2 / GR-3 / CyberOne / CyberDog / IRON
     **规则**：机型代号一字不改（包括字母数字后缀如 H1 / S2 / GR-3 / 03），绝不"翻译性扩写"
   - 机器人模型与框架（举例 + 通用规则）：GR00T / Isaac / Isaac Sim / Isaac Lab / MuJoCo / Gazebo / ROS / ROS 2 / LeRobot / OpenPi / π0 / RT-2 / OpenVLA / Diffusion Policy / ACT / ALoha / ALOHA / RoboCasa / Genesis / ManiSkill / RoboTwin / PyBullet / Drake
     **规则**：任何机器人模型、仿真器、框架名一律保留英文
   - 技术缩写（举例 + 通用规则）：VLA / SLAM / MPC / WBC / RL / IL / DoF / IMU / LiDAR / RGB-D / ToF / FSR / UART / CAN / EtherCAT / ROS / URDF / MJCF / SDK / API
     **规则**：任何 2-5 字母的全大写缩写，默认按机器人/工程含义保留英文
   - 评测基准（举例 + 通用规则）：RoboCup / DARPA Robotics Challenge / BEHAVIOR-1K / CALVIN / RLBench / Meta-World / LIBERO / SimplerEnv / Open X-Embodiment
     **规则**：评测与竞赛名一律保留英文
   - 芯片与平台：NVIDIA Jetson / Orin / Thor / Blackwell / CUDA / TensorRT / Isaac GR00T N1

3. 中国厂商**优先用官方中文品牌名**（首次出现可双标"宇树（Unitree）"，后续选一种保持一致）：
   - 宇树（Unitree）/ 智元（AgiBot）/ 傅利叶智能（Fourier）/ 优必选（UBTECH）/ 越疆（Dobot）/ 云深处（Deep Robotics）/ 众擎（EngineAI）/ 星动纪元（Astribot）/ 银河通用（Galbot）/ 松灵 / 大疆（DJI）/ 追觅 / 科沃斯 / 石头 / 小鹏 / 小米 / 华为 / 比亚迪 / 埃斯顿 / 新松 / 节卡 / 遨博 / 大族 / 汇川 / 绿的谐波 / 三花 / 拓普 / 鸣志 / 兆威机电 / 因时机器人 / 灵心巧手 / 强脑科技

4. 代码 / 命令 / URL / 数字单位 **一字不改**保留：
   - 反引号代码 `code` 不翻译
   - 命令如 ros2 launch、pip install、git clone 不译
   - URL 原样
   - 数字+单位：22 DoF / 1.7m / 55kg / 200 TOPS / 3.5x speedup / $16,000 / 99.9%
   - 金额、参数、比例、区间必须保留原文的阿拉伯数字和单位；不要把 $16,000 改写成"一万六千美元"等中文数量词，不要把 22 DoF 写成"二十二个自由度"
