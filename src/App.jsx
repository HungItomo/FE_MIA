import dayjs from 'dayjs';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  FloatButton,
  Form,
  Input,
  InputNumber,
  Layout,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  TimePicker,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckOutlined,
  CoffeeOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  HeartFilled,
  LeftOutlined,
  MoonOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  StarFilled,
} from '@ant-design/icons';
import { PumpTracker, SleepTracker } from './featureTrackers.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4002/api';
const GOAL_STORAGE_KEY = 'mia-milk-goal';
const DATE_FORMAT = 'YYYY-MM-DD';
const BABY_NICKNAME = 'Mía';
const BABY_FULL_NAME = 'Nguyễn Ngọc An Khuê';

const getLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTime = () => new Date().toTimeString().slice(0, 5);

const addDays = (dateString, amount) => {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return getLocalDate(date);
};

const formatLongDate = (dateString) => new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${dateString}T12:00:00`));

const formatShortDate = (dateString) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(`${dateString}T12:00:00`));

const isToday = (dateString) => dateString === getLocalDate();

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Không thể kết nối tới máy chủ.');
  return body;
}

function App() {
  const today = getLocalDate();
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeTab, setActiveTab] = useState('milk');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [isMilkModalOpen, setIsMilkModalOpen] = useState(false);
  const [addButtonPosition, setAddButtonPosition] = useState(null);
  const [isAddButtonDragging, setIsAddButtonDragging] = useState(false);
  const addButtonDragRef = useRef(null);
  const addButtonMovedRef = useRef(false);
  const featureAddActionRef = useRef(null);
  const [goal, setGoal] = useState(() => Number(localStorage.getItem(GOAL_STORAGE_KEY)) || 800);
  const [form, setForm] = useState({ date: today, time: getCurrentTime(), amountMl: '', note: '' });

  const selectedEntries = useMemo(
    () => entries
      .filter((entry) => entry.date === selectedDate)
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)),
    [entries, selectedDate],
  );

  const totalMl = selectedEntries.reduce((sum, entry) => sum + entry.amountMl, 0);
  const progress = Math.min(Math.round((totalMl / goal) * 100), 100);
  const groupedHistory = useMemo(() => {
    const byDate = entries.reduce((groups, entry) => {
      groups[entry.date] ||= { date: entry.date, total: 0, count: 0 };
      groups[entry.date].total += entry.amountMl;
      groups[entry.date].count += 1;
      return groups;
    }, {});
    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError('');
      setEntries(await request('/entries'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, []);

  useEffect(() => {
    setForm((current) => ({ ...current, date: selectedDate }));
  }, [selectedDate]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const updateGoal = (value) => {
    const nextGoal = Math.max(1, Number(value) || 1);
    setGoal(nextGoal);
    localStorage.setItem(GOAL_STORAGE_KEY, String(nextGoal));
  };

  const resetForm = (date = selectedDate) => {
    setEditingEntry(null);
    setForm({ date, time: getCurrentTime(), amountMl: '', note: '' });
  };

  const openAddModal = () => {
    resetForm(selectedDate);
    setError('');
    setIsMilkModalOpen(true);
  };

  const closeMilkModal = () => {
    setIsMilkModalOpen(false);
    if (editingEntry) resetForm();
  };

  const handleAddButtonPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    addButtonDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    addButtonMovedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsAddButtonDragging(true);
  };

  const handleAddButtonPointerMove = (event) => {
    const drag = addButtonDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) addButtonMovedRef.current = true;
    if (!addButtonMovedRef.current) return;

    event.preventDefault();
    const left = Math.min(Math.max(8, drag.startLeft + deltaX), window.innerWidth - drag.width - 8);
    const bottomNavSafeSpace = 82;
    const maxTop = window.innerHeight - drag.height - bottomNavSafeSpace;
    const top = Math.min(Math.max(8, drag.startTop + deltaY), Math.max(8, maxTop));
    setAddButtonPosition({ left, top });
  };

  const handleAddButtonPointerUp = (event) => {
    if (addButtonDragRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    addButtonDragRef.current = null;
    setIsAddButtonDragging(false);
  };

  const handleAddButtonClick = () => {
    if (addButtonMovedRef.current) {
      addButtonMovedRef.current = false;
      return;
    }
    if (activeTab === 'milk') openAddModal();
    else featureAddActionRef.current?.();
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    featureAddActionRef.current = null;
    if (tab !== 'milk') setIsMilkModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.date || !form.time || !form.amountMl) {
      setError('Bạn hãy nhập đầy đủ ngày, giờ và lượng sữa đã uống.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const payload = { ...form, amountMl: Number(form.amountMl) };
      if (editingEntry) {
        const updated = await request(`/entries/${editingEntry.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setEntries((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
        messageApi.success('Đã cập nhật lần uống sữa.');
      } else {
        const created = await request('/entries', { method: 'POST', body: JSON.stringify(payload) });
        setEntries((current) => [...current, created]);
        messageApi.success('Đã lưu cữ sữa mới.');
      }
      setSelectedDate(form.date);
      resetForm(form.date);
      setIsMilkModalOpen(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    try {
      await request(`/entries/${entry.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      messageApi.success('Đã xoá khỏi lịch sử.');
      if (editingEntry?.id === entry.id) resetForm();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const beginEdit = (entry) => {
    setEditingEntry(entry);
    setForm({ date: entry.date, time: entry.time, amountMl: String(entry.amountMl), note: entry.note || '' });
    setIsMilkModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const milkForm = (
    <Form layout="vertical" requiredMark={false} onFinish={handleSubmit}>
      <Form.Item label="Ngày uống">
        <DatePicker value={dayjs(form.date)} onChange={(value) => value && updateForm({ date: value.format(DATE_FORMAT) })} format="DD/MM/YYYY" allowClear={false} size="large" style={{ width: '100%' }} />
      </Form.Item>
      <Row gutter={10}>
        <Col span={10}><Form.Item label="Giờ uống"><TimePicker value={dayjs(`2000-01-01T${form.time}`)} onChange={(value) => value && updateForm({ time: value.format('HH:mm') })} format="HH:mm" minuteStep={5} allowClear={false} size="large" style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={14}><Form.Item label="Lượng sữa (ml)"><InputNumber min={1} max={3000} step={10} placeholder="Ví dụ 120" value={form.amountMl ? Number(form.amountMl) : null} onChange={(value) => updateForm({ amountMl: value ?? '' })} size="large" style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
      <div className="quick-amounts"><Text type="secondary">Chọn nhanh</Text><Space wrap>{[60, 90, 120, 150, 180].map((amount) => <Button key={amount} type={Number(form.amountMl) === amount ? 'primary' : 'default'} onClick={() => updateForm({ amountMl: amount })}>{amount} ml</Button>)}</Space></div>
      <Form.Item label={<span>Ghi chú <Text type="secondary">(không bắt buộc)</Text></span>} className="note-field"><Input.TextArea rows={3} maxLength={160} showCount placeholder="Ví dụ: Bé uống ngon, ngủ sau đó..." value={form.note} onChange={(event) => updateForm({ note: event.target.value })} /></Form.Item>
      <Button type="primary" htmlType="submit" size="large" block icon={editingEntry ? <CheckOutlined /> : <PlusOutlined />} loading={saving}>{editingEntry ? 'Lưu thay đổi' : 'Lưu cữ sữa'}</Button>
      {editingEntry && <Button type="link" block onClick={closeMilkModal}>Huỷ chỉnh sửa</Button>}
    </Form>
  );

  const timelineItems = selectedEntries.map((entry) => ({
    color: '#9dbba2',
    dot: <ClockCircleOutlined className="timeline-icon" />,
    children: (
      <div className="entry-content">
        <div className="entry-meta">
          <Text strong>{entry.time}</Text>
          <Text type="secondary">{isToday(entry.date) ? 'Hôm nay' : formatShortDate(entry.date)}</Text>
        </div>
        <div className="entry-main">
          <div>
            <Text className="entry-amount">{entry.amountMl} <small>ml</small></Text>
            {entry.note && <Paragraph className="entry-note">{entry.note}</Paragraph>}
          </div>
          <Space size={2} className="entry-actions">
            <Tooltip title="Chỉnh sửa">
              <Button type="text" shape="circle" icon={<EditOutlined />} onClick={() => beginEdit(entry)} />
            </Tooltip>
            <Popconfirm
              title="Xoá cữ sữa này?"
              description={`Lần uống lúc ${entry.time}, ${entry.amountMl} ml`}
              okText="Xoá"
              cancelText="Huỷ"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(entry)}
            >
              <Tooltip title="Xoá">
                <Button type="text" danger shape="circle" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>
      </div>
    ),
  }));

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Header className="app-header">
        <div className="header-inner">
          <div className="brand-lockup">
            <div className="brand-mark"><HeartFilled /></div>
            <div><Text className="eyebrow">MIA / FAMILY CARE</Text><Title level={4}>Sổ sữa của {BABY_NICKNAME}</Title><Text className="brand-subtitle">{BABY_FULL_NAME}</Text></div>
          </div>
          <Badge status="success" text="Dữ liệu được lưu tự động" />
        </div>
      </Header>

      <Content className="main-content">
        {activeTab === 'milk' && <>
        <div className="decor decor-star decor-star-one"><StarFilled /></div>
        <div className="decor decor-star decor-star-two"><StarFilled /></div>
        <div className="decor decor-dot decor-dot-one" />
        <div className="decor decor-dot decor-dot-two" />
        <section className="intro-row">
          <div className="intro-copy">
            <Text className="hero-kicker"><StarFilled /> HÀNH TRÌNH LỚN KHÔN CỦA {BABY_NICKNAME.toUpperCase()}</Text>
            <Title>Mỗi ngày của <span>{BABY_NICKNAME}</span><br />bắt đầu từ những cữ sữa nhỏ.</Title>
            <Paragraph>Theo dõi nhẹ nhàng cho <strong>{BABY_FULL_NAME}</strong> — để từng ml sữa đều trở thành một dấu mốc yêu thương.</Paragraph>
          </div>
          <div className="intro-side">
            <div className="baby-profile">
              <Avatar size={58} className="baby-avatar">M</Avatar>
              <div className="baby-profile-copy"><Text className="eyebrow">BÉ YÊU CỦA GIA ĐÌNH</Text><Title level={4}>{BABY_FULL_NAME}</Title><Tag color="gold"><HeartFilled /> Bé Mía</Tag></div>
              <div className="profile-sparkle"><StarFilled /></div>
            </div>
            <Card className="date-card" size="small">
              <Text className="field-caption"><CalendarOutlined /> Ngày đang xem</Text>
              <DatePicker
                value={dayjs(selectedDate)}
                onChange={(value) => value && setSelectedDate(value.format(DATE_FORMAT))}
                format="DD/MM/YYYY"
                allowClear={false}
                size="large"
                suffixIcon={<CalendarOutlined />}
              />
            </Card>
          </div>
        </section>

        {error && <Alert className="page-alert" type="error" showIcon message={error} closable onClose={() => setError('')} />}

        <Row gutter={[22, 22]} className="dashboard-grid">
          <Col xs={24} lg={16}>
            <Space direction="vertical" size={22} className="column-stack">
              <Card className="overview-card card-surface">
                <div className="card-heading">
                  <div><Text className="eyebrow">TỔNG QUAN</Text><Title level={3}>{isToday(selectedDate) ? 'Hôm nay' : formatLongDate(selectedDate)}</Title></div>
                  <Space.Compact>
                    <Button icon={<LeftOutlined />} onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="Ngày trước" />
                    <Button onClick={() => setSelectedDate(today)}>Hôm nay</Button>
                    <Button icon={<RightOutlined />} onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="Ngày sau" />
                  </Space.Compact>
                </div>

                <Row gutter={[30, 24]} align="middle" className="overview-content">
                  <Col xs={24} sm={9} className="progress-col">
                    <Progress
                      type="dashboard"
                      percent={progress}
                      width={166}
                      strokeColor="#b7765b"
                      trailColor="#e9e5db"
                      format={() => <div className="progress-label"><strong>{totalMl}</strong><span>ml đã uống</span></div>}
                    />
                  </Col>
                  <Col xs={24} sm={15}>
                    <Statistic title="Mục tiêu trong ngày" value={goal} suffix="ml" />
                    <Space size={8} className="goal-setting">
                      <SettingOutlined />
                      <Text type="secondary">Điều chỉnh mục tiêu</Text>
                      <InputNumber min={1} step={50} value={goal} onChange={updateGoal} size="small" />
                    </Space>
                    <Divider className="stat-divider" />
                    <Row gutter={14} className="mini-stats">
                      <Col span={8}><Statistic title="Cữ sữa" value={selectedEntries.length} /></Col>
                      <Col span={8}><Statistic title="Mục tiêu" value={progress} suffix="%" /></Col>
                      <Col span={8}><Statistic title="Trung bình" value={selectedEntries.length ? Math.round(totalMl / selectedEntries.length) : 0} suffix="ml" /></Col>
                    </Row>
                  </Col>
                </Row>
                <div className="progress-bottom"><div className="progress-line"><span style={{ width: `${progress}%` }} /></div><Text type="secondary">{progress >= 100 ? 'Tuyệt vời, bé đã đạt mục tiêu hôm nay!' : `Còn ${Math.max(goal - totalMl, 0)} ml để chạm mục tiêu hôm nay`}</Text></div>
              </Card>

              <div className="section-heading"><div><Text className="eyebrow">NHẬT KÝ</Text><Title level={3}>Các cữ sữa trong ngày</Title></div><Space size={8}><Tag color="green">{selectedEntries.length} lần</Tag><Tooltip title="Thêm cữ sữa"><Button className="desktop-add-button" type="primary" shape="circle" icon={<PlusOutlined />} onClick={openAddModal} aria-label="Thêm cữ sữa" /></Tooltip></Space></div>
              <Card className="journal-card card-surface">
                {loading ? <div className="state-box"><Spin tip="Đang tải nhật ký..." /></div> : selectedEntries.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>Chưa có cữ sữa nào trong ngày này</span>} /> : <Timeline className="entry-timeline" items={timelineItems} />}
              </Card>
            </Space>
          </Col>

          <Col xs={24} lg={8}>
            <Space direction="vertical" size={22} className="column-stack">
              <Card className="history-card card-surface" title={<div className="history-title"><div><Text className="eyebrow">NHÌN LẠI</Text><Title level={3}>Lịch sử gần đây</Title></div><BarChartOutlined /></div>}>
                {groupedHistory.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lịch sử sẽ xuất hiện sau khi bạn lưu cữ sữa đầu tiên." /> : <List dataSource={groupedHistory.slice(0, 6)} split={false} renderItem={(day) => <List.Item className="history-list-item"><Button type="text" block className={`history-day ${day.date === selectedDate ? 'active' : ''}`} onClick={() => setSelectedDate(day.date)}><span className="history-calendar"><strong>{new Date(`${day.date}T12:00:00`).getDate()}</strong><small>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(new Date(`${day.date}T12:00:00`))}</small></span><span className="history-info"><strong>{isToday(day.date) ? 'Hôm nay' : formatShortDate(day.date)}</strong><small>{day.count} cữ sữa</small></span><strong className="history-total">{day.total}<small> ml</small></strong></Button></List.Item>} />}
              </Card>
            </Space>
          </Col>
        </Row>
        </>}
        {activeTab === 'pump' && <PumpTracker messageApi={messageApi} addActionRef={featureAddActionRef} />}
        {activeTab === 'sleep' && <SleepTracker messageApi={messageApi} addActionRef={featureAddActionRef} />}
      </Content>

      {activeTab === 'milk' && <Modal
        className="milk-modal"
        open={isMilkModalOpen}
        centered
        width={520}
        footer={null}
        onCancel={closeMilkModal}
        title={<div><Text className="eyebrow">{editingEntry ? 'CHỈNH SỬA' : 'GHI NHẬN MỚI'}</Text><Title level={3}>{editingEntry ? 'Cập nhật cữ sữa' : `Thêm cữ sữa cho ${BABY_NICKNAME}`}</Title></div>}
      >
        {milkForm}
      </Modal>}
      <FloatButton
        className={`mobile-add-float ${isAddButtonDragging ? 'is-dragging' : ''}`}
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAddButtonClick}
        onPointerDown={handleAddButtonPointerDown}
        onPointerMove={handleAddButtonPointerMove}
        onPointerUp={handleAddButtonPointerUp}
        onPointerCancel={handleAddButtonPointerUp}
        style={addButtonPosition ? { left: `${addButtonPosition.left}px`, top: `${addButtonPosition.top}px`, right: 'auto', bottom: 'auto' } : undefined}
        tooltip="Chạm để thêm • Kéo để di chuyển"
      />

      <nav className="bottom-nav" data-active-tab={activeTab} aria-label="Các chức năng của MIA">
        <span className="bottom-nav-indicator" aria-hidden="true" />
        <Button type="text" className={activeTab === 'milk' ? 'active' : ''} onClick={() => changeTab('milk')} icon={<CoffeeOutlined />}><span>Uống sữa</span></Button>
        <Button type="text" className={activeTab === 'pump' ? 'active' : ''} onClick={() => changeTab('pump')} icon={<ExperimentOutlined />}><span>Mẹ hút sữa</span></Button>
        <Button type="text" className={activeTab === 'sleep' ? 'active' : ''} onClick={() => changeTab('sleep')} icon={<MoonOutlined />}><span>Giấc ngủ</span></Button>
      </nav>

      <Footer className="app-footer">MIA <span>•</span> Nhật ký sữa của Mía</Footer>
    </Layout>
  );
}

export default App;
